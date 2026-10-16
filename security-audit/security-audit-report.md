# Laporan Audit Keamanan — DFauna / Catavor

**Tanggal**: 2026-10-16
**Scope**: backend Go (Fiber + GORM, 76 file, ~31.3k LOC) + frontend React TS (desktop/mobile)
**Metode**: manual code review, grep pattern berbahaya, cek dependency CVE, cek git history
**Status**: read-only — tidak ada perubahan apapun

**Verdict**: Solid di lapisan aplikasi — di atas rata-rata untuk project sebesar ini. Ada 2 isu HIGH
+ 1 misconfig produksi sebelum deploy publik. Klaim "100% selesai" di `SECURITY_CHECKLIST.md` tidak akurat.

---

## 🔴 HIGH

### H1. `err.Error()` + raw request body bocor ke klien
- **Lokasi**: `backend/internal/handlers/auth_handler.go:1555`
  ```go
  "message": "Format data tidak valid: " + err.Error() + " (body: " + string(c.Body()) + ")",
  ```
- **Endpoint**: `SendRegistrationOTP`
- **Dampak**: body request mentah di-echo ke HTTP response (info disclosure; kredensial di payload
  registrasi bisa tercermin; masuk ke log/monitoring).
- **Fix**: pesan generik ke klien, detail hanya ke log server.

### H2. Dependency punya CVE aktif
| Package | Versi | CVE | Fix |
|---|---|---|---|
| github.com/gofiber/fiber/v2 | v2.52.5 | CVE-2025-66630 (CVSS 9.2), CVE-2025-48075 | bump ke latest 2.52.x |
| github.com/golang-jwt/jwt/v5 | v5.2.1 | CVE-2025-30204 (memory alloc DoS) | **wajib** >= v5.2.2 |
| github.com/go-playground/validator/v10 | v10.23.0 | — | bump |

- **Fix**: `go get -u github.com/golang-jwt/jwt/v5@v5.2.2 github.com/gofiber/fiber/v2@latest && go mod tidy`
  lalu `govulncheck ./...`

---

## 🟠 MEDIUM

### M1. JWT di `localStorage`
- **Lokasi**: `frontend/desktop/src/utils/apiClient.ts:106`, `App.tsx` (banyak titik)
- **Dampak**: 1 XSS = full account takeover. Tidak ada cookie httpOnly (server tak pernah SetCookie).

### M2. CSP longgar — `'unsafe-inline' 'unsafe-eval'` di `script-src`
- **Lokasi**: `backend/internal/middleware/security.go:37`
- **Dampak**: mematikan proteksi utama CSP anti-XSS. `img-src ... https: http:`,
  `connect-src 'self' https: http:` juga wildcard penuh.
- **Fix**: nonce/hash untuk script, hapus `unsafe-eval`.

### M3. State keamanan in-memory (bypass saat restart / multi-instance)
- **Lokasi**: `backend/internal/database/redis.go:282-418`
- **Dampak**: tanpa Redis (fallback mode), blacklist JWT / lockout login / rate-limit hidup di RAM.
  Restart server → token yang sudah logout valid lagi, counter brute-force reset. Multi-replica →
  counter terpisah per instance (brute-force 5x lebih efektif).
- **Fix**: Redis WAJIB di produksi.

### M4. `err.Error()` bocor ke klien di banyak handler
- **Lokasi**: `analytics_handler.go:1105,1124,1135`, `notification_handler.go:1273-1300`,
  `dormancy_handler.go:105`, dsb.
- **Dampak**: bocorkan detail internal (tipe error DB, path).

---

## 🟢 LOW / HARDENING

- **L1. Path traversal potensial** — `support_handler.go:2312` (`ServeAttachment`): lookup fallback
  `storage_key LIKE ? OR file_url LIKE ?` dgn `%input%` lalu `filepath.Join(StorageLocalRoot, key)`.
  Ada guard RBAC + `isRegularFile`, jadi bukan open traversal, tapi `LIKE %input%` ambigu.
  `DeleteFile` sudah punya prefix-check (bagus).
- **L2. `SanitizeRichText` regex-based** — `security/sanitizer.go`: blacklist tag, bukan allowlist/parse.
  Bisa di-bypass (nested/malformed/encoding). Mitigasi: frontend pakai AST + React auto-escape.
- **L3. CORS `AllowCredentials: true`** — `security.go:57`: aman karena `AllowOrigins` eksplisit;
  pastikan `ALLOWED_ORIGINS` prod TIDAK menyertakan wildcard.
- **L4. Default JWT secret ikut di allowlist `.gitleaks.toml`** + `config.go:82`: di prod hanya warning,
  tidak men-stop startup. Sebaiknya `log.Fatal` di env production kalau `JWT_SECRET` masih default.
- **L5. `err.Error()` di `dormancy_handler.go:49`** — cek jangan sampai ke response.
- **L6. `DB_SSLMODE=disable`** di `.env` — untuk DB remote prod wajib `require`/`verify-full`.

---

## ✅ Sudah benar (terverifikasi)

- **SQL injection**: bersih. Semua query GORM parameterized; `db.Exec`/`db.Raw` (db.go) hanya DDL/migration
  statis, tanpa interpolasi input user. Tidak ada `fmt.Sprintf` ke SELECT/WHERE/ORDER.
- **JWT**: alg pinning benar (`SigningMethodHMAC` check auth.go:148), cek `token.Valid`, blacklist jti,
  token-version invalidation.
- **Password**: bcrypt cost 12 (`models/user.go:32`), boundary 8-72 byte (cegah bcrypt truncation).
- **IDOR/multi-tenant**: `StoreOwnerRequired` + query dgn `user_id`; product Update `Where("id=? AND store_id=?")`;
  session revoke `Where("id=? AND user_id=?")`; attachment RBAC owner/staff. Konsisten.
- **File upload**: magic-byte `http.DetectContentType` + `%PDF-` prefix, re-encode JPEG buang EXIF,
  UUID filename, limit 10MB, quota per-store.
- **XSS frontend**: zero `dangerouslySetInnerHTML`, zero `eval`/`new Function`. `urlSecurity.ts` solid
  (protocol whitelist, block javascript:/data:/blob:, noopener,noreferrer).
- **Rate limiting**: global API + auth + public-submission limiter, key per-IP (kecuali M3).
- **Secrets**: `.env` TIDAK ke-track git (git check-ignore konfirmasi), tidak ada di history,
  ada `.gitleaks.toml` + GitHub Actions gitleaks workflow.
- **HTTP headers**: nosniff, X-Frame-Options, Referrer-Policy, COOP, Permissions-Policy, HSTS (saat secure).
- **Recover middleware + request-id** aktif.

---

## Kesesuaian standar industri

| Standar | Status |
|---|---|
| OWASP Top 10 — A03 Injection | 🟢 lolos |
| OWASP Top 10 — A01 Broken Access Control | 🟢 multi-tenant konsisten |
| OWASP Top 10 — A06 Vulnerable Components | 🔴 gagal (H2) |
| OWASP Top 10 — A05 Security Misconfig | 🟠 CSP lemah + fallback in-memory |
| OWASP Top 10 — A07 Auth Failures | 🟢 (butuh Redis di prod) |
| SOC 2 / ISO 27001 (Fase 2 server) | 🟡 belum dimulai (checklist sendiri menandai ini) |

**Kesimpulan**: kode aplikasi mendekati standar industri. Yang bikin belum siap produksi:
CVE dependency belum dipatch (H2), info leak via `err.Error()`/body (H1/M4), CSP `unsafe-eval` (M2),
Redis tidak boleh opsional di prod (M3). Semua perbaikan cepat, bukan rewrite.
