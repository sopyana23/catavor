# Perbaikan H1 & H2 — Laporan Eksekusi

**Tanggal**: 2026-10-16
**Baseline**: `security-audit-report-update.md` (re-audit)
**Status**: ✅ SELESAI & TERVERIFIKASI RUNTIME

---

## H2 — Dependency CVE (FIXED)

### Sebelum → Sesudah

| Package | Sebelum | Sesudah |
|---|---|---|
| `golang-jwt/jwt/v5` | v5.2.1 (CVE-2025-30204) | **v5.3.1** ✅ |
| `gofiber/fiber/v2` | v2.52.5 (CVE-2025-66630, CVE-2025-48075) | **v2.52.15** ✅ |
| `go-playground/validator/v10` | v10.23.0 | **v10.30.5** ✅ |
| `golang.org/x/image` | v0.0.0-2019… (12 CVE) | **v0.47.0** ✅ |
| `golang.org/x/net` | v0.58.0 | **v0.61.0** ✅ |
| `jackc/pgx/v5` | v5.5.5 | **v5.11.0** ✅ |
| Go toolchain | go1.26.0 | **go1.26.1** ✅ |

### Hasil `govulncheck`

```
Sebelum : 39 vulnerabilities (2 modules + stdlib)
Sesudah : 25 vulnerabilities — 100% dari Go STANDARD LIBRARY
          (module dependency: BERSIH, `Module:` kosong)
```

**Sisa 25 vuln = Go standard library.** Butuh toolchain lebih baru:
- go1.26.1 → sisa 25 (butuh 1.26.2 untuk sebagian)
- go1.27.2 → **gagal build** di mesin ini (`Access is denied` pada `compile.exe`,
  kemungkinan diblokir antivirus/permission pada toolchain hasil unduhan)

**Rekomendasi lanjutan**: upgrade Go ke **≥1.26.2** (idealnya versi terbaru stabil)
di environment build/CI, lalu `govulncheck ./...` ulang. Ini pekerjaan infra, bukan kode.

**Catatan**: mayoritas trace stdlib mengarah ke `storage.go:57` (`io.Copy` → `x509.Verify`)
— paparan TLS/upload, bukan input langsung user.

---

## H1 — Kebocoran Body Request (FIXED)

### Perubahan
`backend/internal/handlers/auth_handler.go` — `SendRegistrationOTP`:

```go
// SEBELUM (bocor):
"message": "Format data tidak valid: " + err.Error() + " (body: " + string(c.Body()) + ")",

// SESUDAH:
log.Warn().Err(err).Str("parse_error", uErr.Error()).
    Str("path", c.Path()).Str("ip", c.IP()).
    Msg("SendRegistrationOTP: invalid request body")
return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
    "success": false,
    "message": "Format data tidak valid.",
})
```

Detail error + body hanya ke **log server**; klien menerima pesan generik.

### Verifikasi RUNTIME (server di-restart dengan binary baru)

| Uji | Hasil |
|---|---|
| Body rusak berisi `"password":"LEAKTEST_999"` | `{"message":"Format data tidak valid."}` — **tidak bocor** ✅ |
| Body tipe salah (`[1,2,3]`) | pesan generik, HTTP 400 ✅ |
| `grep 'body: " + string'` di handlers | **BERSIH** ✅ |

### Regresi — semua kontrol masih utuh

| Uji | Hasil |
|---|---|
| Login normal | HTTP 200 ✅ |
| JWT valid diterima (`/auth/verify`) | HTTP 200 ✅ |
| JWT ngawur ditolak | HTTP 401 ✅ |
| Akses store asing (`X-Store-Slug` milik orang lain) | HTTP 403 ✅ |
| `go build ./...` | exit 0 ✅ |

---

## Status temuan audit

| ID | Item | Status |
|---|---|---|
| **H1** | `err.Error()` + body bocor | ✅ **FIXED** |
| **H2** | CVE dependency | ✅ **FIXED** (module bersih; sisa stdlib = butuh Go baru) |
| M1 | JWT di localStorage | ⬜ terbuka |
| M2 | CSP `unsafe-inline`/`unsafe-eval` | ⬜ terbuka |
| M3 | State in-memory fallback Redis | ⬜ terbuka |
| M4 | `err.Error()` di 10+ handler lain | ⬜ terbuka (H1 hanya titik terparah) |
| L1–L6 | LOW | ⬜ terbuka |

**Progress: 2 HIGH tertutup. Sisa 4 MED + 6 LOW.**

---

## Catatan operasional

- Binary `backend/catavor-server.exe` sudah di-rebuild (go1.26.1) & dijalankan ulang.
- Backup `go.mod`/`go.sum` sebelum bump ada di `/tmp` (sesi sementara) — riwayat tetap aman di git.
- **Rekomendasi**: jalankan `govulncheck ./...` di CI (GitHub Actions) tiap PR agar CVE baru ketahuan lebih awal.
