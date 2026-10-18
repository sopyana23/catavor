# Audit Keamanan — Putaran 6 (Deep Re-Audit Menyeluruh)

**Tanggal:** 18 Oktober 2026
**Target:** DFauna / Catavor (Go 1.26 + Fiber v2.52.15 + GORM, React 19 SPA)
**Metode:** audit ulang dari nol — laporan audit sebelumnya diperlakukan sebagai *klaim yang harus diuji ulang*, bukan fakta.
**Total temuan kumulatif:** 38 · **fixed:** 34 · **verified-ok:** 1 · **open:** 3

---

## Ringkasan Eksekutif

Audit ulang menemukan **4 celah baru** (N-29, N-31, N-33, N-34, N-35) yang tidak terdeteksi laporan sebelumnya — termasuk satu **HIGH** yang membuat whitelist anti-phishing bisa diubah staf mana pun.

Sebaliknya, **3 klaim temuan lama terbukti SALAH** dan ditarik kembali. Ini bagian penting dari laporan: audit yang hanya menambah temuan tanpa pernah mengoreksi diri sendiri tidak bisa dipercaya.

---

## Temuan Baru

### N-29 — HIGH — Master `safe-domains` terbuka untuk semua staf platform

`safe_domains` adalah whitelist domain yang dipakai frontend `safeHref` untuk **membuka tautan TANPA peringatan konfirmasi anti-phishing**. Rute terdaftar **dua kali** di `adminApi` (`main.go:510-515` dan `526-531`) dan **tanpa** `RequirePermission`, sehingga lolos dengan `RequireAdmin` saja — artinya **semua** staf platform (support, content, finance).

**Dampak nyata:** staf support dapat menambahkan domain penyerang ke whitelist, lalu seluruh pengguna platform membuka tautan ke domain itu tanpa guard. Ini melemahkan kontrol anti-phishing secara global.

**Bukti runtime (sebelum perbaikan):**
- Akun `platform_role='support'` → `POST /api/admin/safe-domains` **201**
- DB mencatat `domain=evil-n29b.example`
- State dipulihkan persis: `users=1`, `safe_domains=3`, ids `23,25,34`

**Perbaikan:** 5 rute duplikat dihapus; rute tunggal diberi `RequirePermission(cfg, "system:settings:manage")` (izin hanya Superadmin).

**Verifikasi (sesudah):** support `GET/POST/PUT/reset` → **403**, DB tidak bertambah · superadmin → **200** dan daftar utuh (`catavor.com`, `catavor.id`, dst). **10 PASS / 0 FAIL.**

---

### N-31 — HIGH — `pdfjs-dist` rentan eksekusi JavaScript sembarang

`pdfjs-dist@3.11.174` (advisory GHSA-wgrm-67xf-hhpq, rentan ≤4.7.76) dipakai `DocumentPreviewModal` untuk membuka **PDF unggahan pengguna** — ini *runtime dependency*, bukan build-time. PDF berbahaya berpotensi mengeksekusi JS di origin aplikasi.

**Mitigasi parsial yang sudah ada:** `isEvalSupported: false` + CSP ketat (`script-src 'self'` + hash, tanpa `unsafe-inline`/`eval`).

**Perbaikan:** upgrade ke `pdfjs-dist@6.4.299` (menghapus 63 paket, termasuk `canvas`, `node-pre-gyp`, `tar`) + `npm audit fix`.

**Verifikasi:**
- `npm audit` desktop & mobile: **7 vuln (1 critical, 4 high, 2 moderate) → 0**
- Typecheck kedua SPA: exit **0**
- `vite build` kedua SPA: **PASS** — 1 bundel + `pdf.worker.min-*.mjs`, MIME `text/javascript`
- **Uji fungsional nyata** (harness Node, bukan sekadar "build lolos"): PDF uji dimuat → 1 halaman, viewport 200×200, teks `HALO` terekstrak, `render()` tersedia

**Catatan implementasi:** v6 menghapus `pdf.worker.min.js` (kini hanya `.mjs`) — build sempat gagal sampai import diperbaiki ke `pdfjs-dist/build/pdf.worker.min.mjs?url`.

---

### N-33 — MEDIUM — Pencabutan role tidak meng-invalidate sesi aktif

`RevokeStaffRole` mengubah role di DB tetapi **tidak** menyentuh `token_version` maupun blacklist token. Otorisasi RBAC sendiri **sudah benar** (membaca role dari DB, bukan klaim token) sehingga `/admin/*` langsung 403 — tetapi token JWT lama tetap diterima endpoint terautentikasi biasa sampai kedaluwarsa (24 jam). Staf yang dipecat tetap memegang sesi hidup.

**Bukti runtime (sebelum):** token staf → `/api/auth/me` **200** setelah role dicabut.

**Perbaikan:** panggil `RevokeAllSessionsForUser` (blacklist TokenID + tandai sesi revoked + bump `token_version`).

**Verifikasi lewat jalur nyata** (revoke via API, bukan DB manual): `POST /admin/rbac/staff/revoke` → **200**, role jadi `merchant`, token lama → **401 `SESSION_REVOKED`**. **5 PASS / 0 FAIL.**

---

### N-34 — LOW — Runtime toolchain tidak di-pin

`pdfjs-dist@6.4.299` butuh Node `>=22.13.0`; `vite@8.1.4` butuh `^20.19 || >=22.12`. Mesin build lokal memakai **Node 20.13.1** — di bawah keduanya (`EBADENGINE`). Repo tidak punya pin versi Node, dan CI hanya menjalankan gitleaks **tanpa step build**, jadi hasil build bergantung mesin siapa yang menjalankan.

**Perbaikan:** `engines.node: ">=22.13.0"` di kedua `package.json` + `.nvmrc` berisi `22.13.0`.

**Verifikasi:** build ulang kedua SPA exit 0 dengan **hash bundel identik** (`index-CIb2qLus.js`, `index-y3D47Wht.js`, `pdf.worker.min-CjEcRF4W.mjs`) → deterministik. Runtime: kedua SPA render (H1 tampil, `#root` 1 anak, ErrorBoundary `false`, **0 console error**, 0 JS error).

> **Belum selesai:** mesin lokal **masih** Node 20.13.1. Pin sudah jujur melaporkan ketidakcocokan, tapi upgrade Node belum dilakukan.

---

### N-35 — LOW — (OPEN) Audit log hanya mencakup 5 aksi RBAC

Aksi yang tercatat: `RBAC_ACCESS_DENIED`, `RBAC_CUSTOM_ROLE_CREATED`, `RBAC_ROLE_PERMISSIONS_UPDATED`, `RBAC_STAFF_ROLE_ASSIGNED`, `RBAC_STAFF_ROLE_REVOKED`.

**Tidak tercatat:** login sukses/gagal, ganti password, hapus toko, ubah settings. Tidak ada jejak "siapa mengubah apa" untuk aksi destruktif di luar RBAC.

**Mitigasi parsial:** `user_sessions` merekam IP + User-Agent tiap login (`RecordUserSession` dipanggil di 5 titik; terverifikasi **41 baris**). Login terlacak forensik, hanya tidak masuk log governance.

**Tidak ada kebocoran kredensial di log** — 0 pemakaian `log` untuk password/token/secret/otp.

---

## Klaim Lama yang TERBUKTI SALAH (ditarik)

| Klaim | Kenyataan |
|---|---|
| "CSRF tidak terpasang" | **SALAH.** Terpasang di `middleware/security.go:107` via `SetupSecurity`. Diuji runtime: POST origin asing → **403**, origin sah → **200**, GET tidak diblokir. |
| "JWT Issuer/Audience di-set tapi tidak divalidasi" | **SALAH.** Tidak pernah di-set sama sekali — bukan setengah implementasi. |
| "`canned-responses` tanpa permission" | **SALAH.** Sudah dijaga `support:tickets:reply`. |
| "N-32 = bug PDF fungsional" | **SALAH.** Uji A/B: teks tetap terekstrak tanpa `standardFontDataUrl` → hanya hardening. |

---

## Area yang Terverifikasi Aman

| Area | Hasil |
|---|---|
| Backend CVE | **0 vulnerability reachable.** 1 advisory level-module `GO-2026-5932` (`x/crypto/openpgp`, *unmaintained*, `Fixed in: N/A`) **tidak reachable** — kode hanya memakai `x/crypto/bcrypt`, nol import `openpgp` (`go mod why` → *main module does not need package*) |
| Frontend CVE | `npm audit` → **0 vulnerabilities** (desktop & mobile) |
| Secret hygiene | `JWT_SECRET` **wajib** di-set, min 32 char, dan **menolak nilai legacy yang bocor di git** (dicocokkan via SHA-256, bukan plaintext). Diuji runtime: kosong → server mati; 6 char → server mati. |
| XSS | 0 `dangerouslySetInnerHTML`, 0 `innerHTML`, 0 `eval`/`Function` di kedua SPA |
| SQLi | Seluruh `Raw`/`Exec` memakai string statis (DDL), tanpa interpolasi input |
| CSRF | Origin/Referer whitelist — 403 untuk origin asing |
| CSP | `script-src 'self'` + hash, tanpa `unsafe-inline`/`eval` |
| Upload | Validasi magic bytes (`DetectContentType`), path traversal dicegah `ResolveInsidePrefix` |
| SSRF | Fetch server-side hanya ke URL Google tetap; tidak ada URL dari input user |
| Error disclosure | `safeErrMsg` menyaring jejak DB + fallback generik |
| Brute force | Rate limit login per-IP 20/menit **+ lockout per-akun 5×/15 menit** (fail-closed bila Redis mati di production) |
| Sesi | `user_sessions` merekam IP/UA; revoke kini mematikan token (N-33) |
| Password | bcrypt cost 12; field `Password` ber-`json:"-"`; respons login pakai whitelist eksplisit |
| Multi-tenant | Semua query mutasi di-scope `store_id` (diverifikasi per-handler) |

---

## Sisa Pekerjaan

1. **N-21** (open) — sudah diturunkan; data di-wipe, keputusan arsitektur ditunda.
2. **N-32** (open, low) — aset `standard_fonts/` + `cmaps/` belum disalin ke bundel. Bukan bug fungsional.
3. **N-35** (open, low) — perluas audit log ke login/password/store-delete/settings.
4. **Node upgrade** — mesin lokal masih 20.13.1; pin sudah ada tapi belum dipenuhi.
5. **`git filter-repo`** untuk JWT secret legacy di history — butuh keputusan pemilik repo (irreversible).
6. **N-13/N-14 E2E** — mustahil tanpa Google ID token asli.
