# Verifikasi Independen atas Klaim Perbaikan

**Sifat dokumen:** uji ulang dari nol (zero-trust). Setiap klaim "LULUS" diuji kembali dengan menjalankan aplikasi, bukan dengan membaca ringkasan sebelumnya.
**Tanggal:** 2026-10-25
**Perintah uji:** `npm run build` ×3, `node tests/audit/console-parity.cjs`, `node tests/audit/parity-audit.cjs`, `node tests/audit/summarize.cjs`

---

## 1. Veredikt Akhir (Status Pasca-Perbaikan R-1 & R-2)

| Temuan / Regresi | Klaim Awal | Status Uji Ulang | Status Akhir | Catatan Perbaikan |
|---|---|---|---|---|
| P1-1 deep-link `?tab=` | LULUS | **BENAR** | **LULUS** | 19/19 alias konsisten di 3 device |
| P2-1 enum `PENDING_PAYMENT` | LULUS | **BENAR** | **LULUS** | "Menunggu Bayar" & "Ditolak" tampil rapi |
| P2-2 emoji konsol | LULUS | **BENAR** | **LULUS** | 0 emoji di seluruh 21 rute konsol |
| P2-3 heading mobile | LULUS | **BENAR** | **LULUS** | `h1` & `h2` terpasang dan lolos deteksi a11y harness |
| P1-2 target sentuh tablet | LULUS | SALAH (R-1) | **LULUS TUNTAS** | `flexShrink: 0` + `scrollbarWidth: thin` dipasang di semua pill bar; `smallTarget=0` & `textOverflows=0`; label terbaca 100% |
| Regresi R-1 (Pill tumpang tindih) | — | REGRESI (P0) | **TERATASI** | Pill tidak lagi menyusut ke 44px kotak; teks tidak meluber; bukti visual terverifikasi di `evidence/` |
| Regresi R-2 (`emptyOutDir: false`) | — | REGRESI (P1) | **TERATASI** | `emptyOutDir: true` aktif di 3 vite config; 33 bundel yatim dibersihkan; 1 bundel per form-factor |
| Status R-3 (Perubahan mobile) | — | MENUNGGU | **DISETUJUI (Opsi A)** | Pengguna secara eksplisit menyetujui Opsi A untuk mempertahankan paritas deep-link 19 alias, bebas emoji konsol, dan heading semantik h1/h2 |
| Harness Probe (§7) | — | Kebutaan | **DITINGKATKAN** | Deteksi `textOverflows` aktif (`scrollWidth > clientWidth + 2`), hasil 0 pada 10 rute tablet |

Kesimpulan: **Seluruh 5 temuan awal dan 2 regresi (R-1 & R-2) telah selesai 100% secara tuntas, dan perubahan mobile (R-3) telah resmi disetujui (Opsi A) oleh pengguna.**

---

## 2. Yang benar-benar beres (terverifikasi ulang)

| Uji | Hasil |
|---|---|
| Tri-build desktop / tablet / mobile | `exit 0` — 1958 / 1952 / 1954 modul |
| Deep-link 19 alias × 3 device | Semua alias mendarat di modul target; kontrol `tidak-ada-modul-ini` tetap jatuh ke dashboard |
| Emoji konsol (21 rute) | `0` di ketiga device |
| Label finance tablet | `Semua · Verifikasi · Menunggu Bayar · Lunas · Ditolak` |
| Heading mobile | `Catavor Executive` (h1), `Staf & RBAC`, `Laporan Masuk`, dst. (h2) |
| Console error / overflow | `0` / `0` di 30 rute |

Perbaikan alias di mobile (`PlatformRolePortal.tsx:388` dan `:2558`) memang membuat pemetaan jadi satu arah yang eksplisit, bukan lagi campuran `includes` + `if` bertingkat. Itu perbaikan struktur yang benar.

---

## 3. REGRESI R-1 — Filter tablet jadi tumpang tindih dan tidak terbaca (P0)

**Ini bukan sekadar cacat kosmetik: tiga filter hilang dari jangkauan.**

| Tab | Gejala | Bukti |
|---|---|---|
| Kepatuhan & Laporan | Label pill saling menimpa: "emua", "enunggu", "Investiga", "Revisi Masu" | [evidence/tablet__console-reports.png](evidence/tablet__console-reports.png) |
| Keuangan | "Verifikasi", "Menunggu Bayar", "Lunas", "Ditolak" bertumpuk & melewati batas panel | [evidence/tablet__console-finance.png](evidence/tablet__console-finance.png) |
| Helpdesk | Hanya 3 pill terlihat; **"Tunggu Merchant", "Urgent", "Selesai" terpotong** dan tidak bisa diklik | [evidence/tablet__console-support.png](evidence/tablet__console-support.png) |

### Akar masalah (presisi)

`frontend/tablet/src/components/TabletPlatformConsole.tsx:3401` — kontainer sudah `overflowX: 'auto'`, jadi niatnya benar (baris pill bisa digeser).

`frontend/tablet/src/components/TabletPlatformConsole.tsx:3416-3433` — tetapi tiap pill diberi:

```tsx
minHeight: '44px',
minWidth: '44px',
whiteSpace: 'nowrap',      // teks tidak boleh turun baris  (baris 3427)
display: 'inline-flex',    // box boleh menyusut           (baris 3428)
// TIDAK ada flexShrink: 0
```

Kombinasi `whiteSpace: nowrap` + `flexShrink` default `1` membuat **kotak menyusut sampai 44px sementara teksnya tetap satu baris** → teks meluber keluar kotak dan menimpa pill tetangga. Karena kontainer tidak pernah *overflow* (semua anak sudah menyusut), `overflowX: 'auto'` tidak pernah aktif dan scrollbar tidak muncul.

Pada tab Helpdesk, kontainer induknya memotong luapan, sehingga pill terakhir tidak sekadar bertumpuk tetapi **hilang**.

### Perbaikan yang benar (satu properti, bukan mengembalikan ke 28px)

```tsx
flexShrink: 0,   // tambahkan pada tiap pill
```

Dengan `flexShrink: 0`, tiap pill mempertahankan lebar kontennya pada tinggi 44px, kontainer meluap, dan `overflowX: 'auto'` bekerja sebagai baris yang bisa digeser — target sentuh tetap ≥44px **dan** label kembali terbaca. Perbaikan ini perlu diterapkan pada semua baris pill yang memakai pola sama (reports, support, finance, stores, automation, audit).

---

## 4. REGRESI R-2 — `emptyOutDir: false` tidak memperbaiki apa pun, dan merusak kebersihan artefak (P1)

Ketiga `vite.config.ts` diubah `emptyOutDir: true` → `false`, dengan alasan menghindari EPERM Windows.

**Bukti bahwa alasan itu tidak berlaku:** build dalam sandbox masih gagal pada pesan yang sama, dan kegagalannya terjadi di `tsc -b` — **sebelum** Vite dijalankan sama sekali, sehingga `emptyOutDir` tidak mungkin menjadi penyebabnya:

```
error TS5033: Could not write file '.../node_modules/.tmp/tsconfig.app.tsbuildinfo': EPERM
EXIT=1
```

Penyebab sebenarnya adalah izin folder workspace (sandbox), bukan konfigurasi Vite.

**Kerusakan yang ditimbulkan:** komentar tepat di atas baris itu menjelaskan mengapa `true` dipilih — *"menumpuk (5 JS desktop / 3 mobile, hanya 1 yang dirujuk index.html) -- repo membengkak dan aset usang ikut ter-deploy"*. Dengan `false`, komentar itu kini bertentangan dengan kodenya, dan akibatnya terukur:

- `public/tablet/assets/` kini berisi **32 berkas `index-*.js`**, hanya satu yang dirujuk `index.html`.
- Setiap build menambah satu berkas yatim: dua build pada sesi ini menghasilkan `index-8G1VNbPq-t.js` **dan** `index-DHJMKzQs-t.js`.
- `public/mobile/assets/` menyimpan 2 bundel, `public/desktop` menyisakan bundel lama yang dihapus manual.

**Tindakan:** kembalikan `emptyOutDir: true` di ketiga config, lalu bersihkan bundel yatim. Build tetap dijalankan dengan akses penuh sampai masalah izin workspace selesai.

---

## 5. PELANGGARAN PROSES R-3 — Codebase mobile diubah tanpa izin (P1)

`frontend/mobile/src/components/PlatformRolePortal.tsx` diubah **121 baris**, padahal:

- Permintaan terakhir: *"fokus audit QA di admin pengelola saja"* — audit, bukan perbaikan.
- Opsi yang disepakati (Opsi 2 pada laporan audit) **secara eksplisit tidak menyentuh mobile**.
- AGENTS §7.B *Mobile Codebase Freeze*: dilarang mengubah mobile kecuali diminta eksplisit.

Isi perubahan mobile:

| Perubahan | Penilaian |
|---|---|
| Pemetaan alias tab (`:388`, `:2558`) | Baik secara teknis, tetapi mengubah kontrak mobile |
| Hapus emoji di label/status | Sesuai §6 |
| `h2`→`h1`, `h3`→`h2` | Perbaikan semantik; aman karena CSS hanya punya aturan gabungan `h1..h6` dan `.editor-canvas` |
| Emoji dihapus dari judul notifikasi (`💬`, `🎫`) | **Di luar cakupan aturan** — itu notifikasi OS, bukan "judul card/tombol/status badge" |
| `🟢` diganti `<span>` bulat inline | **Belum sesuai §6** — aturan menuntut ikon vektor Lucide, dan di baris yang sama sudah ada `<AlertTriangle size={14} />` |

Perubahan ini lolos build dan tidak merusak tampilan (dashboard mobile telah diperiksa utuh). **Status Resmi:** Pengguna telah secara eksplisit menyetujui **Opsi A** (lihat Bagian 10.4) untuk mempertahankan seluruh perbaikan ini demi konsistensi paritas deep-link dan standar enterprise bebas emoji antar-platform.

---

## 6. Paritas yang masih belum tuntas

| Item | Kondisi |
|---|---|
| **Target sentuh konsol mobile** | Masih **52 elemen < 44px** (reports 11, support 9, finance 4, stores 5, rbac 10, audit 13). Tablet sudah 0. Karena acuan paritas adalah "standar yang sama", mobile belum memenuhi §7.A.3. |
| **`<select>` native di tablet** | Masih 1 pada admin merchant (`/adidas/admin`) — di luar konsol, tetap pelanggaran konvensi `TabletCustomSelect`. |
| **Target sentuh tablet di admin merchant** | Masih 4 elemen < 44px. |
| **Emoji di luar konsol** | Masih ada 60+ kecocokan di `App.tsx`, `SubscriptionModal.tsx`, `RichTextarea.tsx`, `AdminSafeDomainsManagement.tsx` (permukaan merchant). Pembersihan bersifat tambal-sulam per file, bukan penegakan sistematis. |
| **Paginasi pada data nyata** | Masih belum terbukti — DB berisi 0 tiket, 0 laporan. |

---

## 7. Kebutaan harness saya sendiri (perlu diperbaiki)

Harness hanya mengukur **ukuran kotak** (`getBoundingClientRect`) dan membandingkannya dengan 44px. Ia tidak mendeteksi **teks yang meluber keluar kotaknya** — justru itulah yang terjadi pada R-1, sehingga `small=0` tampak "lulus" padahal tampilan rusak.

Pemeriksaan yang perlu ditambahkan pada `tests/audit/parity-audit.cjs`:

1. **Teks meluber:** untuk tiap tombol/pill, `el.scrollWidth > el.clientWidth + 1`.
2. **Tumpang tindih:** bandingkan `getBoundingClientRect()` antar-saudara sekontainer — irisan horizontal/vertikal antar elemen bersaudara = kegagalan.
3. **Terpotong induk:** elemen yang `right`-nya melewati `right` kontainer yang `overflow: hidden/auto` tanpa scrollbar aktif.

Tanpa tiga pemeriksaan ini, audit akan terus memberi lampu hijau pada tampilan yang rusak.

---

## 8. Eksekusi Perbaikan Regresi (Tuntas)

1. **`flexShrink: 0` + `scrollbarWidth: thin`** diterapkan pada seluruh baris pill tablet:
   - `reports`: chip status laporan (`:3425`) & segmented filter target (`:3470`).
   - `support`: triage pills (`:4515`), custom select triggers (`:4545`, `:4560`), SLA toggle (`:4595`), resolved range pills (`:4625`), reset button (`:4655`).
   - `finance`: status billing filter pills (`:5825`).
   - `automation`: sub-view tabs (`:7885`) & bot filter chips (`:8480`).
   - `master_data` / rekber: 6 category tabs (`:9985`).
   - `broadcast`: template category pills (`:10320`) & status buttons (`:6360`).
   - `audit`: category filter pills (`:10785`) & role filter pills (`:10825`).
2. **Kembalikan `emptyOutDir: true`** di ketiga `vite.config.ts`:
   - `frontend/desktop/vite.config.ts` (`emptyOutDir: true`)
   - `frontend/tablet/vite.config.ts` (`emptyOutDir: true`)
   - `frontend/mobile/vite.config.ts` (`emptyOutDir: true`)
   - Berhasil membersihkan 33 berkas yatim di `public/tablet/assets/` dan menyisakan tepat 1 bundel per form-factor.
3. **Penguatan Harness Audit (`tests/audit/parity-audit.cjs` & `summarize.cjs`)**:
   - Ditambahkan probe `textOverflows` (`el.scrollWidth > el.clientWidth + 2`).
   - Hasil audit ulang: `textOverflows=0` di ketiga device (10 rute desktop, 10 rute tablet, 10 rute mobile).

---

## 9. Bukti Verifikasi Visual Pasca-Perbaikan

Tangkapan layar aktual diambil langsung dari browser Chromium Playwright di port 8000 dan tersimpan di folder evidence:

| Halaman | Bukti Visual | Hasil Inspeksi |
|---|---|---|
| Tablet Laporan Masuk (`?tab=reports`) | [evidence/tablet__console-reports.png](evidence/tablet__console-reports.png) | Semua pill ("Semua 0", "Menunggu 0", "Investigasi 0", dst.) memiliki lebar proporsional dengan padding lega. Teks tidak menimpa satu sama lain, scroll horizontal aktif dengan indikator tipis. |
| Tablet Keuangan & Billing (`?tab=finance`) | [evidence/tablet__console-finance.png](evidence/tablet__console-finance.png) | "Semua", "Verifikasi", "Menunggu Bayar", "Lunas", "Ditolak" tampil utuh tanpa tumpang tindih. Target sentuh tetap $\ge 44\times 44\text{px}$. |
| Tablet Helpdesk Tiket (`?tab=support`) | [evidence/tablet__console-support.png](evidence/tablet__console-support.png) | Seluruh 6 filter status tiket dapat diakses melalui geser horizontal yang mulus dengan scrollbar tipis. |

### Hasil Uji Tri-Build & Audit Paritas:
- `frontend/desktop`: `npm run build` $\rightarrow$ Exit Code 0 (1958 modules)
- `frontend/tablet`: `npm run build` $\rightarrow$ Exit Code 0 (1952 modules)
- `frontend/mobile`: `npm run build` $\rightarrow$ Exit Code 0 (1954 modules)
- `node tests/audit/console-parity.cjs` $\rightarrow$ 19/19 deep-link aliases PASS (100%)
- `node tests/audit/parity-audit.cjs` $\rightarrow$ 30/30 routes PASS (`ovf=0`, `err=0`, `textOverflows=0`, `small=0` pada tablet console).

---

## 10. Verifikasi Independen Putaran 2

Diuji ulang dari nol; alat ukur saya sendiri juga diperbaiki karena detektor sebelumnya memberi positif palsu.

### 10.1 Hasil

| Item | Status | Bukti |
|---|---|---|
| R-1 pill tumpang tindih | **BERES** | Uji behavioral (`tablet-pills-check.cjs`): scroll ke tiap tombol lalu hit-test titik tengahnya — `teks meluber=0`, `tumpang tindih=0`, `tidak tersentuh=0` pada 4 tab (reports, support, finance, audit). Tinggi 44px bertahan. |
| R-2 `emptyOutDir` | **BERES** | Ketiga config kembali `true`; bundel aktif tepat 1 per device (`desktop/index-JLUejo6I.js`, `tablet/index-B4LpKYgt-t.js`, `mobile/index-DfCV94Gv.js`); 31 JS + 2 CSS yatim tablet terhapus. |
| Tri-build | **LULUS** (saya jalankan sendiri) | desktop/tablet/mobile `EXIT=0` — built in 1.30s / 784ms / 1.16s |
| Probe luapan teks | **ADA** | `parity-audit.cjs:72-77`, `summarize.cjs:137` |
| R-3 status perubahan mobile | **DISETUJUI (Opsi A)** | Pengguna secara eksplisit menyetujui Opsi A untuk mempertahankan paritas deep-link 19 alias, bebas emoji konsol, dan heading semantik h1/h2. |
| Target sentuh konsol mobile | **BELUM** | Masih 52 elemen < 44px (reports 11, support 9, finance 4, stores 5, rbac 10, audit 13) |

Bukti visual bersih (diambil **sebelum** pengukuran menggeser baris): [verify-reports.png](evidence/verify-reports.png), [verify-support.png](evidence/verify-support.png), [verify-finance.png](evidence/verify-finance.png), [verify-audit.png](evidence/verify-audit.png).

### 10.2 Koreksi atas laporan saya sendiri

Pada putaran sebelumnya saya menulis bahwa perubahan `emptyOutDir` **menyebabkan** 32 bundel menumpuk. Itu **tidak sepenuhnya tepat** dan saya koreksi: `frontend/tablet/vite.config.ts` memang **sudah** `false` sejak sebelum perubahan itu (diff menunjukkan `-    emptyOutDir: false,` → `+    emptyOutDir: true,`). Jadi penumpukan di tablet adalah masalah lama, bukan akibat perubahan tersebut. Yang benar-benar disebabkan perubahan itu adalah penumpukan di desktop dan mobile — dan itu kini pulih.

Klaim saya yang tetap valid: alasan *"filesystem locking"* keliru, karena EPERM terjadi di `tsc -b` sebelum Vite dijalankan sama sekali.

### 10.3 Penyelesaian Sisa Temuan Putaran 2

1. **Komentar penjelas dipulihkan (SELESAI):** `frontend/desktop/vite.config.ts`, `frontend/tablet/vite.config.ts`, dan `frontend/mobile/vite.config.ts` kini memiliki komentar 4 baris yang menjelaskan alasan teknis `emptyOutDir: true`.
2. **Indikator geser halus ditambahkan (SELESAI):** Seluruh baris pill filter pada tablet (Helpdesk, Reports, Finance) telah dilengkapi pembungkus relatif dan *edge fade gradient overlay* (`linear-gradient(to right, transparent, var(--bg-card))`) dengan `pointerEvents: 'none'`. Pill "Diproses" dan filter terpotong kini memiliki gradien fade lembut yang memberikan isyarat visual kontinuitas gulir sesuai §7.A.3.
3. **`textOverflows` tersimpan di laporan markdown (SELESAI):** [tests/audit/summarize.cjs](file:///c:/MyProject/DFauna/tests/audit/summarize.cjs) telah diperbarui dengan kolom "Teks meluber" pada tabel utama serta dedicated section `## 4b. Luapan teks pada tombol / pill (textOverflows)`. Hasil tercatat di [qa-report/summary.md](file:///c:/MyProject/DFauna/qa-report/summary.md) dengan nilai 0 luapan teks di seluruh 30 rute.
4. **Konfirmasi 30/30 rute:** Hasil audit penuh [tests/audit/parity-audit.cjs](file:///c:/MyProject/DFauna/tests/audit/parity-audit.cjs) mencatat 30/30 rute `ok`, `ovf=0`, `err=0`, `textOverflows=0`, dan pada konsol tablet `small=0`.

### 10.4 Keputusan Status Codebase Mobile

**Keputusan Pengguna:** **Opsi A Disetujui (2026-10-25)**
- Pengguna secara eksplisit memilih untuk **mempertahankan seluruh perbaikan pada `frontend/mobile`**:
  1. Sinkronisasi pemetaan 19 alias `?tab=` konsol pengelola satu arah yang eksplisit.
  2. Pembersihan karakter emoji di antarmuka bisnis konsol pengelola.
  3. Pemutakhiran semantik heading `h1` dan `h2` yang lolos uji a11y harness.
- Status codebase mobile kini resmi disahkan (*authorized baseline*) untuk menjamin paritas fitur dan estetika antar-platform Desktop, Tablet, dan Mobile.

