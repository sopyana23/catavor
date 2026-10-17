# Audit Keamanan — UPDATE (Re-audit)

**Tanggal**: 2026-10-16 (re-audit setelah commit `0fd2143`)
**Baseline**: `security-audit-report.md` (audit #1, 2026-10-16)
**Metode**: verifikasi ulang tiap temuan lama + audit permukaan baru (kode frontend yang berubah, `tests/`, artefak commit)
**Status**: read-only

---

## Ringkasan Eksekutif

**Skor tidak berubah secara material.** Semua temuan HIGH/MED backend dari audit #1 **masih terbuka** — backend tidak tersentuh sepanjang pekerjaan kemarin (fokus di frontend). Pekerjaan frontend yang di-commit **tidak membuka celah keamanan baru**; satu-satunya perubahan yang menyentuh kontrol akses sudah diverifikasi aman di sisi server.

| | Audit #1 | Re-audit |
|---|---|---|
| HIGH terbuka | 2 | **2 (tetap)** |
| MED terbuka | 4 | **4 (tetap)** |
| LOW terbuka | 6 | **6 (tetap)** |
| Temuan baru | — | **0** |
| Regresi keamanan dari commit | — | **0** |

---

## 1. Temuan lama — status verifikasi ulang

### 🔴 H1. `err.Error()` + raw body bocor — **MASIH ADA**
`backend/internal/handlers/auth_handler.go:1555` — belum tersentuh:
```go
"message": "Format data tidak valid: " + err.Error() + " (body: " + string(c.Body()) + ")",
```
Body request mentah masih di-echo ke response (endpoint `SendRegistrationOTP`).

### 🔴 H2. Dependency CVE aktif — **MASIH ADA**
```
github.com/gofiber/fiber/v2        v2.52.5   ← CVE-2025-66630 (CVSS 9.2), CVE-2025-48075
github.com/golang-jwt/jwt/v5       v5.2.1    ← CVE-2025-30204 (fix di 5.2.2)
github.com/go-playground/validator v10.23.0  ← belum di-bump
```
`go.mod` tidak berubah. Ini **HIGH paling mudah & paling berdampak** — belum dikerjakan.

### 🟠 M1. JWT di `localStorage` — **MASIH ADA**
`frontend/desktop/src/App.tsx:7854, 7952, 11587, 11705, 12029` (+ mobile) masih `localStorage.setItem('catavor_token', ...)`. Tidak ada httpOnly cookie.

### 🟠 M2. CSP `unsafe-inline` + `unsafe-eval` — **MASIH ADA**
`backend/internal/middleware/security.go` — `script-src 'self' 'unsafe-inline' 'unsafe-eval' ...` utuh.

### 🟠 M3. State keamanan in-memory (fallback Redis) — **MASIH ADA**
`redis.go` masih punya `memoryTokenBlacklist` / `memoryLoginFailures` (10 kemunculan). Tanpa Redis: blacklist JWT, lockout, rate-limit reset saat restart.

### 🟠 M4. `err.Error()` bocor di banyak handler — **MASIH ADA**
`analytics_handler.go:1105,1124,1135`; `auth_handler.go:473,835,1421,1444,1555,1600,1627`; dst.

### 🟢 LOW (L1–L6) — **MASIH ADA**
Path traversal potensial `ServeAttachment`, regex-based `SanitizeRichText`, CORS `AllowCredentials`, default JWT secret hanya warning, `DB_SSLMODE=disable`.

**Kesimpulan**: 0 dari 12 temuan audit #1 yang ditutup. Alasan: seluruh pekerjaan kemarin adalah **frontend/resilience**, bukan keamanan backend.

---

## 2. Permukaan baru (dari commit `0fd2143`) — hasil audit

### ✅ Bersih — tidak ada celah baru

**N1. Kredensial tidak masuk repo** ✅
`grep` password/email uji di `tests/`, `security-audit/`, `frontend/` → **bersih**. Test admin yang sempat hardcode kredensial sudah dihapus. `tests/.gitignore` mencakup `node_modules/`, `test-results/`, `.env*`.

**N2. Tidak ada secret tracked** ✅
`git ls-files` → hanya `.env.example` (template kosong). Tidak ada `.env` asli, tidak ada `merchant-*.json` (storageState) ter-commit.

**N3. Bundle build tidak bocor source** ✅
Tidak ada `sourceMappingURL` di bundle produksi, tidak ada file `.map` di `public/`.

**N4. Bundle orphan dibersihkan** ✅
Commit menghapus 3 bundle lama (`index-CMJ-sfnr.js`, `index-C8kznYNT.js`, `index-D6h81tOk.js`) — mengurangi permukaan file usang yang tak dipakai.

### ✅ Perubahan kontrol akses — DIVERIFIKASI AMAN

**N5. Fix refresh multi-store (commit `0fd2143`) — tidak melonggarkan otorisasi.**
Perubahan menerima slug dari `localStorage.catavor_active_slug` di sisi **client**. Kekhawatiran wajar: apakah ini membuka IDOR?

**Bukti diuji langsung (HTTP):**
```
POST /api/products  dengan token merchant A
  X-Store-Slug: shop66698   (store MILIK ORANG LAIN)
→ HTTP 403  {"message":"Akses Ditolak: Anda tidak memiliki otoritas atas profil katalog ini."}
```

**Backend tetap otoritatif** — `StoreOwnerRequired` (`middleware/auth.go`) query
`Where("LOWER(slug) = ? AND user_id = ?", slug, user.ID)`, dan menolak bila tak ada
kecocokan. Client-side hanya UX. **Defense-in-depth utuh; tidak ada regresi otorisasi.**

**N6. ErrorBoundary baru** ✅ — tidak menangkap/menyembunyikan error keamanan; hanya fallback UI. Tidak menyimpan data sensitif.

---

## 3. Catatan proses (bukan celah keamanan)

- Test E2E memakai kredensial lewat **env var** (`CATAVOR_ADMIN_EMAIL` / `_PASSWORD`), tidak di-hardcode.
- Playwright/Chromium terpasang di `tests/node_modules` — tidak ter-commit (gitignored).
- Kredensial merchant uji sempat ditulis di chat/log sesi ini → **disarankan rotasi password** akun uji itu (praktik baik, bukan temuan kode).

---

## 4. Prioritas perbaikan (tidak berubah dari audit #1)

| # | Item | Effort | Dampak |
|---|---|---|---|
| 1 | **H2** — bump `golang-jwt` ≥5.2.2, fiber 2.52.x terbaru, validator; jalankan `govulncheck` | 1 jam | 🔴 tinggi |
| 2 | **H1** — hapus echo `err.Error()`+body di `auth_handler.go:1555` | 10 menit | 🔴 tinggi |
| 3 | **M4** — ganti `err.Error()` → pesan generik di semua handler | 1–2 jam | 🟠 sedang |
| 4 | **M3** — wajibkan Redis di prod (fatal bila absen) | 2 jam | 🟠 sedang |
| 5 | **M2** — CSP nonce/hash, hapus `unsafe-eval` | 4–8 jam | 🟠 sedang |
| 6 | **M1** — migrasi JWT ke httpOnly cookie | 1–2 hari | 🟠 sedang |

**Verifikasi**: `govulncheck ./...` (0 reachable), `grep -rn 'err.Error()' handlers/` (0 di response), uji login/logout lintas restart (token tetap invalid).

---

## Kesimpulan

**Sistem tidak menjadi lebih rentan akibat pekerjaan kemarin** — commit `0fd2143` bersih dari sisi keamanan, dan satu-satunya perubahan sensitif (akses slug) terbukti tidak melemahkan otorisasi server.

**Namun juga tidak menjadi lebih aman**: seluruh 12 temuan audit #1 masih terbuka, termasuk **2 HIGH**. Rekomendasi: kerjakan **H2 + H1 dulu** (≈1 jam, dampak terbesar) sebelum menyentuh Fase 2/3 resilience.
