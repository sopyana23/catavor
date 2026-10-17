# Ringkasan Status Keamanan — Semua Temuan Tertutup

**Tanggal verifikasi akhir**: 2026-10-17
**Total temuan**: 12 (2 High, 4 Medium, 6 Low)
**Status**: ✅ 12/12 tertutup & terverifikasi

---

## Tabel status

| ID | Severity | Temuan | Perbaikan | Bukti verifikasi |
|----|----------|--------|-----------|------------------|
| H1 | High | `err.Error()` + body mentah bocor ke klien | Respons error generik | 0 pola `"message": err.Error()` di handlers/middleware |
| H2 | High | Dependensi rentan (CVE) | `go 1.26.9` di go.mod | `govulncheck ./...` → **No vulnerabilities found** |
| M1 | Medium | JWT di `localStorage` | Cookie HttpOnly + CSRF + tiket SSE | 20 probe runtime + 20 unit test PASS |
| M2 | Medium | CSP lemah (`unsafe-eval`) | SHA-256 hash script | `perbaikan-m2-csp.md` |
| M3 | Medium | State keamanan in-memory | Fail closed di production | 3 titik: startup, blacklist JWT, lockout login |
| M4 | Medium | `err.Error()` bocor di banyak handler | `safe_error.go` | Ada & dipakai |
| L1 | Low | Path traversal / LIKE ambigu | Escape wildcard `LIKE` | `fix(security): L1` commit |
| L2 | Low | Sanitizer regex blacklist | Allowlist parser `x/net/html` | 440 baris, allowlist |
| L3 | Low | CORS `AllowCredentials` | Wildcard ditolak di non-local | `security.go:84` |
| L4 | Low | JWT secret default cuma warning | `log.Fatal` di prod/staging | `config.go:111-112` |
| L5 | Low | `err.Error()` di dormancy_handler | Diganti generik | Commit L1–L6 |
| L6 | Low | `DB_SSLMODE=disable` | Fail closed di prod + `.env.example` | `config.go:127-134` |

---

## Catatan penting per temuan

### H2 — CVE dependensi: terverifikasi tuntas

Sebelumnya tercatat **25 kerentanan Go stdlib** dengan catatan "butuh Go ≥1.26.2
di CI; upgrade lokal gagal (`Access is denied` pada `compile.exe`)".

Verifikasi ulang menunjukkan `go.mod` sudah meminta `go1.26.9`, dan toolchain itu
**berfungsi normal** saat diuji ulang:

```
GOTOOLCHAIN=go1.26.9 govulncheck ./...   → No vulnerabilities found
GOTOOLCHAIN=go1.26.9 go build ./cmd/server → 0
GOTOOLCHAIN=go1.26.9 go test ./internal/security/ ./internal/middleware/ → ok
```

Jadi kendala lama sudah tidak berlaku. **Pastikan CI memakai Go ≥1.26.9**;
kalau CI memakai versi lebih rendah, `go.mod` akan memaksa unduh toolchain
yang benar (perilaku `GOTOOLCHAIN=auto`).

### L6 — perbaikan tambahan

Logika produksi sudah benar (`log.Fatal` bila `disable`), tetapi
`backend/.env.example` masih menampilkan `DB_SSLMODE=disable` sebagai contoh,
tanpa peringatan. Itu mudah ditiru ke produksi. Contoh kini memakai `require`
dengan komentar tegas bahwa server menolak start bila `disable`.

`.env` lokal tetap `disable` — itu disengaja untuk PostgreSQL dev, dan file itu
tidak ter-commit.

### M1 — dua bug ditemukan oleh verifikasi

Lihat `perbaikan-m1-penuh.md`. Ringkas:
1. Replay tiket SSE mengembalikan 200 karena cookie masih sah → diperbaiki.
2. `UserIDFromLocals(uint(0))` mengembalikan `true` → diperbaiki.
3. Koneksi SSE **kedua** di `PlatformRolePortal.tsx` masih membawa JWT di URL
   → ditemukan hanya karena bundle produksi ikut diperiksa.
4. Bundle yatim di `public/*/assets` masih disajikan dan memuat kode rentan
   → dihapus.

---

## Sisa risiko (bukan temuan terbuka, tapi perlu diketahui)

1. **Fallback `?token=` di backend** masih diterima untuk klien lama. Klien web
   (desktop + mobile) sudah tidak memakainya. Bisa dihapus setelah dipastikan
   tidak ada klien lain.
2. **Tiket SSE in-memory** — tidak bertahan restart, tidak dibagi antar
   instance. Multi-instance perlu Redis (M3 sudah mewajibkan Redis di prod).
3. **`style-src 'unsafe-inline'`** masih ada karena React inline style.
   Risiko rendah; butuh refactor styling untuk menghapusnya.
4. **Tanpa refresh token** — sesi berakhir 12 jam, user harus login ulang.
   Ini pilihan desain mitigasi M1, bukan regresi.

---

## Cara memverifikasi ulang sendiri

```bash
cd backend

# CVE
GOTOOLCHAIN=go1.26.9 govulncheck ./...

# Unit test keamanan
GOTOOLCHAIN=go1.26.9 go test ./internal/security/ ./internal/middleware/ -v

# Build
GOTOOLCHAIN=go1.26.9 go build ./...
GOTOOLCHAIN=go1.26.9 go vet ./...

# E2E
cd ../tests && npx playwright test
```
