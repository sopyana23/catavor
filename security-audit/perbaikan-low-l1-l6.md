# Perbaikan L1–L6 (LOW) — Laporan Eksekusi

**Tanggal**: 2026-10-16
**Baseline**: `security-audit-report-update.md`
**Status**: ✅ SEMUA 6 SELESAI & TERVERIFIKASI

---

## L1 — Path traversal pada lampiran support

**File**: `backend/internal/handlers/support_handler.go`

**Sebelum**: `filepath.Join(StorageLocalRoot, cleanKey)` tanpa validasi. `StorageKey`
atau `FileURL` berisi `../` bisa membaca berkas di luar direktori storage.

**Sesudah**: helper baru `resolveInsideRoot(root, key)`:
- Tolak key absolut / berisi `:` (drive letter)
- `filepath.Abs` + `filepath.Rel` → tolak hasil yang diawali `..`
- `EvalSymlinks` bila memungkinkan → symlink keluar root ikut tertangkap

Dipakai di **kedua** jalur resolusi (`StorageKey` dan `FileURL`).

---

## L2 — Sanitizer regex → allowlist (bluemonday)

**File**: `backend/internal/security/sanitizer.go`

**Sebelum**: blacklist regex (`<script>`, `on*`, `javascript:`) — bisa dibypass
dengan trik nested tag, mis. `<scr<script>ipt>alert(1)</scr</script>ipt>`.

**Sesudah**: `bluemonday.NewPolicy()` — **allowlist** berbasis parser HTML asli.
Hanya tag/atribut terdaftar yang dipertahankan:

- Tag teks: `p, br, strong, b, em, i, u, s, del, ins, mark, small, sub, sup`,
  heading `h1–h6`, list `ul/ol/li/dl/dt/dd`, `blockquote, pre, code`,
  tabel `table/thead/tbody/tfoot/tr/th/td/caption/colgroup/col`
- Atribut: `class, title, dir, lang` (global); `align, colspan, rowspan, scope` (tabel)
- Tautan: `href` hanya `http/https/mailto/tel`, `rel="nofollow"`, target blank aman
- Gambar: `src/alt/title/width/height`, tanpa `data:` URI
- Event handler (`onerror`, `onclick`) **mustahil lolos** — tidak ada di allowlist

`SanitizeSocialLinks` juga dialihkan ke policy yang sama.

**Unit test** ditambahkan: `internal/security/sanitizer_test.go` — 10 kasus,
termasuk bypass nested-tag, event handler, `javascript:`, iframe, form.
```
ok  catavor-backend/internal/security  1.028s
```

---

## L3 — CORS wildcard + AllowCredentials

**File**: `backend/internal/middleware/security.go`

- Non-local + `ALLOWED_ORIGINS` mengandung `*` + credentials → **log.Fatal()**
- Non-local + origins kosong → `AllowCredentials = false` (warning)
- Local → perilaku lama dipertahankan

Terverifikasi di local: `Access-Control-Allow-Origin: http://localhost:8000`,
`Allow-Credentials: true` tetap bekerja.

---

## L4 — JWT secret default hanya warning

**File**: `backend/internal/config/config.go`

**Sebelum**: `fmt.Fprintf(os.Stderr, "[CRITICAL SECURITY WARNING]...")` — aplikasi
tetap jalan dengan secret default. Artinya **siapa pun bisa memalsukan JWT** dan
mengambil alih akun mana pun, termasuk superadmin.

**Sesudah**: `log.Fatal()` di production/staging bila secret = default atau
panjang < 32 karakter.

Terverifikasi:
```
APP_ENV=production JWT_SECRET=<default> ./catavor-server.exe
FTL JWT_SECRET tidak aman: jangan pakai default dan minimal 32 karakter ...
```

---

## L5 — `err.Error()` di halaman HTML dormancy

**File**: `backend/internal/handlers/dormancy_handler.go`

**Sebelum**: `fmt.Sprintf(... %s ..., err.Error())` — error mentah masuk ke HTML
response (dan berpotensi XSS bila error memuat karakter HTML).

**Sesudah**: `html.EscapeString(safeErrMsg(err, "Tautan reaktivasi tidak valid atau sudah kedaluwarsa."))`
— pesan aman + di-escape.

---

## L6 — `DB_SSLMODE=disable`

**File**: `backend/internal/config/config.go`

- Production/staging + `DB_SSLMODE=disable` (atau kosong) → **log.Fatal()**
- Local → tetap `disable` (koneksi lokal tidak butuh TLS)

Terverifikasi:
```
APP_ENV=production DB_SSLMODE=disable ./catavor-server.exe
FTL DB_SSLMODE=disable tidak diizinkan di production/staging ...
```

---

## Verifikasi keseluruhan

| Uji | Hasil |
|---|---|
| `go build ./...` | exit 0 ✅ |
| `go vet ./internal/{config,middleware,handlers,security}/` | exit 0 ✅ |
| `go test ./internal/security/` (10 kasus sanitizer) | **ok** ✅ |
| Local: server hidup + login | HTTP 200 / 200 ✅ |
| Local: CORS credentials | header benar ✅ |
| Prod: JWT secret default | **FATAL, menolak start** ✅ |
| Prod: DB_SSLMODE=disable | **FATAL, menolak start** ✅ |
| Prod: tanpa Redis (M3) | **FATAL, menolak start** ✅ |

---

## Status temuan audit

| ID | Item | Status |
|---|---|---|
| H1 | Body request bocor | ✅ FIXED |
| H2 | CVE dependency | ✅ FIXED |
| M3 | Redis fail-closed | ✅ FIXED |
| M4 | `err.Error()` di respons | ✅ FIXED |
| **L1** | Path traversal | ✅ FIXED |
| **L2** | Sanitizer regex | ✅ FIXED |
| **L3** | CORS wildcard | ✅ FIXED |
| **L4** | JWT secret default | ✅ FIXED |
| **L5** | err.Error di HTML | ✅ FIXED |
| **L6** | DB_SSLMODE | ✅ FIXED |
| M1 | JWT di localStorage | ⬜ terbuka |
| M2 | CSP unsafe-eval | ⬜ terbuka |

**Progress: 10 dari 12 tertutup. Sisa: M1 (httpOnly cookie) + M2 (CSP).**

---

## Catatan

- **Dependency baru**: `github.com/microcosm-cc/bluemonday v1.0.27` (+2 transitif).
  Ini penggantian yang tepat: sanitizer buatan sendiri lebih berisiko daripada
  library yang diuji luas untuk keperluan ini.
- **Production sekarang butuh 3 env wajib**: `JWT_SECRET` (≥32 char, bukan default),
  `DB_SSLMODE` (bukan disable), dan Redis tersedia. Server menolak start bila kurang —
  by design (fail closed).
