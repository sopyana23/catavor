# Perbaikan M4 — Kebocoran `err.Error()` di Response API

**Tanggal**: 2026-10-16
**Baseline**: `security-audit-report-update.md`
**Status**: ✅ SELESAI & TERVERIFIKASI RUNTIME

---

## Masalah

31 titik di 6 handler mengembalikan `err.Error()` mentah ke klien lewat JSON
response. Error internal (SQL, nama tabel/kolom, koneksi DB, dsb.) bisa terbaca
penyerang → membantu pemetaan skema & eksploitasi lanjutan.

### Sebaran sebelum perbaikan

| File | Titik |
|---|---|
| `auth_handler.go` | 10 |
| `notification_handler.go` | 8 |
| `subscription_handler.go` | 6 |
| `rbac_handler.go` | 4 |
| `analytics_handler.go` | 3 |
| `dormancy_handler.go` | 1 |
| **Total** | **31** |

---

## Solusi

### 1. Helper terpusat — `internal/handlers/safe_error.go` (baru)

```go
func safeErrMsg(err error, fallback string) string
```

Aturan:
- `gorm.ErrRecordNotFound` → `"Data tidak ditemukan."`
- `gorm.ErrDuplicatedKey` → `"Data sudah ada."`
- Pesan mengandung jejak DB (`sql:`, `sqlstate`, `pq:`, `gorm`, `column`,
  `relation "`, `duplicate key`, `dial tcp`, `connection refused`, `panic`,
  `nil pointer`, dst.) → **fallback generik** + dicatat ke log server
- Selain itu (error bisnis yang ditulis sendiri di `services/`) → **ditampilkan**
  agar UX validasi tetap jelas

### 2. Penerapan

Semua 31 titik diganti `safeErrMsg(err, "<pesan ramah konteks>")`, dengan
`log.Error().Err(err).Msg(...)` agar detail tetap tersedia untuk operasional.

Contoh:
```go
// SEBELUM
return c.Status(400).JSON(fiber.Map{"success": false, "message": err.Error()})

// SESUDAH
log.Error().Err(err).Msg("rbac: UpdateRolePermissions gagal")
return c.Status(400).JSON(fiber.Map{
    "success": false,
    "message": safeErrMsg(err, "Gagal memperbarui izin role."),
})
```

Import `github.com/rs/zerolog/log` ditambahkan di `analytics`, `rbac`,
`subscription` (3 file yang belum punya).

---

## Verifikasi (runtime, server di-restart dengan binary baru)

| Uji | Hasil |
|---|---|
| Titik bocor di sumber (`"message": err.Error()`, `+ err.Error()`) | **0** ✅ |
| `go build ./...` | exit 0 ✅ |
| `go vet ./internal/handlers/` | exit 0 ✅ |
| Respons berisi jejak SQL/GORM/driver | **tidak ada** ✅ |
| Validasi bisnis tetap tampil | `"Mohon lengkapi Nama, Email, dan Link Username Toko."` ✅ |
| Pesan OTP tetap jelas | `"kode verifikasi tidak ditemukan atau belum pernah diminta"` ✅ |

### Regresi — semua kontrol utuh

| Uji | Hasil |
|---|---|
| Login | HTTP 200 ✅ |
| JWT valid (`/auth/verify`) | HTTP 200 ✅ |
| JWT ngawur | HTTP 401 ✅ |
| Akses store bukan milik user | HTTP 403 ✅ |

**Bukti tambahan**: `/api/auth/send-registration-otp` dengan body rusak berisi
rahasia → hanya `{"message":"Format data tidak valid."}` (fix H1 tetap berlaku).

---

## Status temuan audit

| ID | Item | Status |
|---|---|---|
| H1 | Body request bocor | ✅ FIXED |
| H2 | CVE dependency | ✅ FIXED |
| **M4** | **`err.Error()` di response** | ✅ **FIXED** |
| M1 | JWT di localStorage | ⬜ terbuka |
| M2 | CSP `unsafe-inline`/`unsafe-eval` | ⬜ terbuka |
| M3 | State in-memory fallback Redis | ⬜ terbuka |
| L1–L6 | LOW | ⬜ terbuka |

**Progress: 2 HIGH + 1 MED tertutup. Sisa 3 MED + 6 LOW.**

---

## Catatan

- Helper `safeErrMsg` sekarang jadi **pola standar** untuk semua handler baru —
  jangan pernah lagi menulis `err.Error()` ke respons.
- Error bisnis di `services/` sengaja tetap tampil; pastikan pesan di sana tidak
  memuat data sensitif (mis. email/nomor telepon user lain).
- Rekomendasi: tambah rule linter/grep di CI:
  `grep -rn '"message": err.Error()' internal/handlers/` harus kosong.
