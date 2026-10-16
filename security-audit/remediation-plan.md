# Remediation Plan — DFauna / Catavor

Urutan prioritas: **H2 → H1 → M3 → M2 → M4**

## 1. H2 — Patch dependency (paling cepat, dampak tertinggi)
```bash
cd backend
go get -u github.com/golang-jwt/jwt/v5@v5.2.2
go get -u github.com/gofiber/fiber/v2@latest
go get -u github.com/go-playground/validator/v10@latest
go mod tidy
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...
```

## 2. H1 — Stop echo body + err.Error()
`auth_handler.go:1555`
```go
// SEBELUM
"message": "Format data tidak valid: " + err.Error() + " (body: " + string(c.Body()) + ")",

// SESUDAH
log.Warn().Err(err).Msg("SendRegistrationOTP: invalid body format")
return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
    "success": false,
    "message": "Format data tidak valid.",
})
```

## 3. M3 — Redis wajib di produksi
- Set `REDIS_ADDR` / `REDIS_PASSWORD` di `.env` prod.
- Tambah guard startup: kalau `APP_ENV=production` dan Redis tidak up → `log.Fatal`.
- Atau berikan custom `Storage` ke Fiber limiter (`limiter.Config` di `security.go:90,120,137`) supaya
  pakai Redis, bukan in-memory.

## 4. M2 — Harden CSP
`middleware/security.go:37` — hapus `'unsafe-eval'`; ganti `'unsafe-inline'` di `script-src` dengan
nonce/hash. Persempit `img-src`/`connect-src` dari `https: http:` ke domain yang benar-benar dipakai.

## 5. M4 — Ganti semua `err.Error()` di response klien
`analytics_handler.go:1105,1124,1135`, `notification_handler.go:1273-1300`, `dormancy_handler.go:105`,
dll → log detail server-side, response pesan generik.

---

## LOW (opsional, hardening)
- **L1** — `support_handler.go:2312`: ganti lookup `LIKE %input%` dengan exact-match primary key dulu.
- **L2** — `sanitizer.go`: pertimbangkan HTML allowlist parser untuk `SanitizeRichText`.
- **L4** — `config.go:82`: `log.Fatal` bila `JWT_SECRET` masih default di env production.
- **L6** — `.env` prod: `DB_SSLMODE=require` (atau `verify-full`).

---

## Verification
- `govulncheck ./...` → 0 vulns reachable
- `grep -rn 'err.Error()' backend/internal/handlers | grep -i message` → 0 di response JSON
- Test login/logout lintas restart server dengan Redis up → token yang logout tetap invalid
