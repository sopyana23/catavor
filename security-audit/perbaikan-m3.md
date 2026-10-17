# Perbaikan M3 — Redis Wajib di Production (Fail Closed)

**Tanggal**: 2026-10-16
**Baseline**: `security-audit-report-update.md`
**Status**: ✅ SELESAI & TERVERIFIKASI (dual-mode: local + production)

---

## Masalah

Tanpa Redis, aplikasi diam-diam jatuh ke penyimpanan **in-memory** untuk state
keamanan. Konsekuensi:

| State | Disimpan untuk | Risiko saat fallback |
|---|---|---|
| Token blacklist (JWT `jti`) | Logout | Token yang sudah logout **valid lagi** setelah restart |
| Login failure counter | Lockout brute-force | Counter reset → **tak pernah terkunci** |
| Rate limiter | Anti-abuse | Per-replica, tidak konsisten multi-instance |

Sifat buruknya: **kegagalan tidak terlihat**. Aplikasi jalan seolah normal
padahal proteksinya sudah melemah.

---

## Solusi — fail closed, bukan fail open

### 1. Guard startup (`InitRedis`)

```go
if isProductionEnv() {
    log.Fatal().Msg("REDIS WAJIB di production: ...")
}
log.Warn().Msg("APP_ENV bukan production: memakai fallback in-memory. JANGAN dipakai di production.")
```

- **Production tanpa Redis → server menolak start.** Tidak ada deployment yang
  diam-diam berjalan tanpa proteksi.
- **Local/dev → fallback tetap diizinkan**, dengan warning eksplisit tiap start
  agar tidak tanpa sengaja dipakai di prod.

### 2. Guard runtime (Redis mati saat aplikasi sudah berjalan)

| Fungsi | Perilaku di production tanpa Redis |
|---|---|
| `IsTokenBlacklisted` | **return `true`** → token ditolak (fail closed) |
| `IsAccountLoginLocked` | **return `true`, retry 30 dtk** → login ditolak sementara |

Prinsipnya: bila status keamanan **tidak dapat diverifikasi**, jawabannya adalah
**menolak** — bukan "anggap aman".

### 3. Helper

```go
func isProductionEnv() bool          // APP_ENV == production|prod
func securityStateUnavailable() bool // production && !redis
```

`APP_ENV` sudah ada di config (`internal/config/config.go`), nilai default `local`.

---

## Verifikasi — dual-mode, runtime nyata

### Mode production + Redis mati (Redis tidak berjalan di :6379)

```
$ APP_ENV=production ./catavor-server.exe
INF PostgreSQL connected successfully
WRN Redis connection not available; continuing in direct DB fallback mode
FTL REDIS WAJIB di production: tanpa Redis, blacklist token & lockout login
    tidak persisten (token logout bisa valid lagi setelah restart).
    Set APP_ENV=local untuk mode pengembangan, atau sediakan Redis.
exit code: 1
```
✅ **Server menolak start.** Tidak ada fallback diam-diam.

### Mode local + Redis mati (kondisi saat ini di mesin dev)

```
$ APP_ENV=local ./catavor-server.exe
WRN Redis connection not available; continuing in direct DB fallback mode
WRN APP_ENV bukan production: memakai fallback in-memory. JANGAN dipakai di production.
```
```
GET  /            → HTTP 200
POST /api/auth/login → HTTP 200
```
✅ **Local tetap jalan seperti sebelumnya.** Tidak ada perubahan perilaku
untuk pengembangan.

### Build

```
go build ./...            → exit 0
go vet ./internal/database/ → exit 0
```

---

## Dampak operasional (penting dibaca)

Ini mengubah Redis menjadi **dependency wajib di production**. Konsekuensi:

1. **Redis harus punya persistensi** (AOF/RDB) — kalau Redis restart dengan data
   kosong, blacklist boleh hilang dan penyerang dengan token lama bisa masuk.
   Fail-closed hanya menangani Redis *mati*, bukan Redis *kosong*.
2. **Monitoring Redis wajib** — kalau Redis down, login/logout berhenti (503/penolakan),
   bukan degradasi diam-diam.
3. **Set `APP_ENV=production` di prod** — kalau lupa, guard tidak aktif dan
   aplikasi akan fallback ke memori seperti dulu.

---

## Status temuan audit

| ID | Item | Status |
|---|---|---|
| H1 | Body request bocor | ✅ FIXED |
| H2 | CVE dependency | ✅ FIXED |
| M3 | State in-memory fallback Redis | ✅ **FIXED** |
| M4 | `err.Error()` di respons | ✅ FIXED |
| M1 | JWT di localStorage | ⬜ terbuka |
| M2 | CSP `unsafe-inline`/`unsafe-eval` | ⬜ terbuka |
| L1–L6 | LOW | ⬜ terbuka |

**Progress: 2 HIGH + 2 MED tertutup. Sisa 2 MED + 6 LOW.**

---

## Catatan implementasi

- Perubahan terpusat di `backend/internal/database/redis.go` — tidak ada handler
  yang perlu diubah; semua pemanggil (`auth_handler`, `middleware/auth`,
  `session_service`) otomatis mendapat perilaku fail-closed.
- `securityStateUnavailable()` disediakan untuk pemakaian eksplisit di masa depan
  (mis. mengembalikan 503 dengan pesan "layanan autentikasi sedang tidak tersedia").
