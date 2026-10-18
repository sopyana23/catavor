# Putaran 8 — Cakupan Test services/storage & Tiga Temuan Baru

Tanggal: 2026-10-18
Fokus: `backend/internal/storage`, `backend/internal/services`, `.github/workflows/ci.yml`

## Ringkasan

Menulis test perilaku untuk modul yang belum tersentuh. Tiga kerentanan baru
ditemukan dan ditutup (N-40, N-41, N-42). CI kini punya ambang batas coverage
per paket yang terbukti menangkap regresi.

---

## N-40 — `Delete`/`DeletePrefix` menghapus file di luar storage root (high)

**Masalah.** `LocalStorageService.Delete` memakai
`filepath.Join(s.localRoot, key)` lalu `os.Remove`, tanpa normalisasi atau
verifikasi. `DeletePrefix` memakai `os.RemoveAll` dengan pola yang sama. Key
berisi `..` menghapus file/direktori mana pun yang dapat dijangkau proses.

**Bukti sebelum perbaikan.** Test membuat file korban di luar root lalu memanggil
`Delete` dengan key relatif yang menunjuk ke sana:

```
HASIL: Delete MENGHAPUS file di luar root -> RENTAN
HASIL: DeletePrefix MENGHAPUS direktori di luar root -> RENTAN
```

**Tingkat bahaya nyata.** Jalur HTTP `/api/storage/file` sudah memvalidasi key
lewat `ResolveInsidePrefix` (perbaikan N-03), jadi ini **bukan** jalur serangan
aktif melalui endpoint itu. Yang menjadi masalah: lapisan storage tidak
mempertahankan invariannya sendiri, sementara jalur otomatis (dormancy &
retention worker) meneruskan key dari `extractStorageKeyFromURL` apa adanya.
Satu pemanggil baru yang lupa memvalidasi cukup untuk menghapus data di luar
storage.

**Perbaikan.** `resolveSafeKey()`: tolak key kosong, path absolut, dan skema
drive; normalisasi + `EvalSymlinks`; verifikasi `filepath.Rel` tidak keluar root.
Kedua fungsi wajib memakainya. `DeletePrefix` juga menolak `RemoveAll` pada root
storage itu sendiri.

**Verifikasi.**
- 8 test di `internal/storage/storage_delete_test.go` — 4 skenario serangan,
  4 kontrol positif (file sah tetap terhapus, tenant tetangga tidak tersentuh).
- Kontrol negatif: implementasi lama **GAGAL**
  (`REGRESI: file di luar root ikut terhapus`), implementasi baru **LULUS**.
- Runtime: `DELETE /api/storage/file` key `../../backend/.env` → **403**;
  file sah milik toko sendiri → **200**; file tenant lain → **403** dan utuh.

---

## N-41 — `GetUserPermissions` memakai daftar hitam role (medium)

**Masalah.** `HasPermission` sudah memakai whitelist `models.IsPlatformStaff`
(perbaikan N-25), tetapi `GetUserPermissions` masih memakai logika lama:
hanya menolak `""` dan `"merchant"`. Role sampah seperti `superadminx` dianggap
staf dan menembus cache — termasuk wildcard `*`.

**Bukti sebelum perbaikan.**

```
role sampah "superadminx" seharusnya tidak punya permission, dapat [*]
--- FAIL: TestGetUserPermissions_RejectsGarbageRole
```

**Perbaikan.** Kedua fungsi kini memakai `models.IsPlatformStaff()` dan
`models.NormalizePlatformRole()` — satu sumber kebenaran, fail-closed.

**Verifikasi.** Kontrol negatif: kode lama gagal, kode baru lulus. Runtime:
`/api/admin/rbac/me` untuk superadmin tetap 19 permission; matriks RBAC utuh.

Catatan: `admin` **bukan** role sah — daftar resminya di
`models.PlatformStaffRoles` adalah superadmin, support, compliance, finance,
content. Ekspektasi test awal saya salah soal ini dan sudah dikoreksi.

---

## N-42 — `generateSecureToken` mengabaikan error `crypto/rand` (low)

`_, _ = rand.Read(bytes)` membuat kegagalan rand menghasilkan token
`000...0` yang identik setiap kali. Token ini dipakai untuk link reaktivasi
toko dorman. Sekarang error diperiksa dan fungsi mengembalikan string kosong
(fail-closed) sehingga pemanggil membatalkan penerbitan link.

Diverifikasi: 500 sampel, panjang 64 hex, tanpa duplikat, tidak seluruhnya nol.

---

## Ambang batas coverage di CI

Angka coverage global menyesatkan: `handlers` 0.4% dan `services` 2.5% akan
menutupi penurunan di `security` (90.2%). Karena itu CI memakai ambang
**per paket**:

| Paket | Coverage | Ambang |
|---|---|---|
| `internal/security` | 90.2% | 85 |
| `internal/models` | 31.4% | 28 |
| `internal/storage` | 26.1% | 22 |
| `internal/services` | 2.5% | 2 |

Skrip ambang diuji lokal: lolos pada nilai nyata, dan **gagal** saat diberi
ambang mustahil (999%) — jadi gerbangnya benar-benar bekerja, bukan selalu hijau.

---

## N-43 — `parsePrice` membuang semua titik/koma (low, kode mati)

```go
strings.ReplaceAll(strings.ReplaceAll(v, ".", ""), ",", "")
```

`"150000.50"` → `"15000050"` (**100× lipat**), `"1500,50"` → `"150050"`,
`"12.5"` → `125`. Pemisah ribuan dan desimal diperlakukan identik.

**Dampak nyata — jujur: terbatas.** `faunaHandler` **tidak dirutekan** di
`cmd/server/main.go`. `POST /api/fauna` diarahkan ke `productHandler.Store`,
dan `ProductRequest.Price` bertipe `float64`, jadi harga string ditolak **400**
sebelum `parsePrice` dipanggil. Ini bug pada kode yang tidak dapat dijangkau
HTTP hari ini.

Tetap diperbaiki karena kode mati bisa diaktifkan kembali tanpa disadari, dan
perilaku salah yang sudah terbukti tidak boleh dibiarkan.

**Perbaikan.** Aturan pemisah eksplisit: titik = ribuan hanya bila berpola
kelompok 3 digit (`1.500.000`), koma = desimal bila muncul sekali diikuti ≤2
digit, mendukung `1.500.000,50` (ID) dan `1,500,000.50` (EN), plus awalan `Rp`.

**Verifikasi.** 19 kasus test. Kontrol negatif: logika lama **GAGAL 6 kasus**
(`parsePrice("150000.50") = 1.500005e+07`); logika baru lulus semua.
Runtime: `POST /api/fauna` price `150000.5` (angka) → **201**, DB menyimpan
`150000.50`; price sebagai string → **400**.

---

## N-44 — `clipClientLog` panik bila `max <= 0` (low, defensif)

`s[:max]` tanpa pemeriksaan → `slice bounds out of range` untuk `max` negatif.
Tidak dapat dipicu dari HTTP: semua pemanggil memakai konstanta positif
(2000/8000/300/40/80). Diperbaiki agar fungsi pembatas tidak pernah panik.

---

## Status jujur cakupan test

| Paket | Baris | Coverage | Perubahan |
|---|---|---|---|
| `internal/security` | ~1.5k | **90.2%** | — |
| `internal/models` | ~3k | 31.4% | — |
| `internal/storage` | ~230 | **26.1%** | +26.1 (dari 0) |
| `internal/services` | 7.327 | **2.5%** | +1.7 |
| `internal/handlers` | 16.909 | **1.4%** | +1.0 (dari 0.4) |
| `cmd/*` | — | 0% | — |

**Yang belum:** `handlers` (16.909 baris) dan `services` (7.327 baris) tetap
nyaris tanpa test. Keduanya butuh lapisan database (sqlmock atau refactor
dependensi global `database.DB` / `services.GetRBACService()`). Coverage ini
**belum** cukup untuk klaim "siap produksi" menyeluruh — yang terbukti aman
adalah modul di tabel tersebut, bukan seluruh backend.

