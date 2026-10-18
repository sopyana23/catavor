# Putaran 7 — Test Perilaku & Tiga Kerentanan Baru

Tanggal: 2026-10-18
Cakupan: `backend/internal/security`, `backend/internal/models` (test), `backend/internal/handlers` (perbaikan)

## Ringkasan

Pekerjaan menaikkan coverage backend menemukan **tiga kerentanan nyata** yang tidak
terdeteksi oleh 39 temuan putaran sebelumnya, karena semuanya berada di dalam
fungsi yang selama ini tidak punya test perilaku (coverage 28.9%).

| ID | Severity | Ringkas | Status |
|---|---|---|---|
| N-37 | high | `SanitizeVideoURL` cocokkan domain sebagai substring → URL pihak ketiga lolos | fixed |
| N-38 | medium | `UserIDFromLocals` terima NaN/Inf sebagai user ID sah + string overflow | fixed |
| — | — | `productHandler` pakai `SanitizeURL` (bukan `SanitizeVideoURL`) untuk `video_url` | fixed |

Semua dibuktikan dengan **kontrol negatif**: test yang sama dijalankan terhadap
kode lama (GAGAL) dan kode baru (LULUS), lalu diverifikasi ulang lewat API pada
server yang benar-benar dibangun ulang.

## Bukti coverage

| Paket | Sebelum | Sesudah |
|---|---|---|
| `internal/security` | 28.9% | **90.2%** |
| `internal/models` | 0.0% | **31.4%** |
| `internal/handlers` | 0.4% | 0.4% (belum disentuh) |
| `internal/services` | 0.8% | 0.8% (belum disentuh) |

Test baru:
- `internal/security/sanitizer_behavior_test.go` — 494 baris, 14 fungsi sanitizer
- `internal/security/locals_test.go` — normalisasi user_id, termasuk NaN/Inf/overflow
- `internal/models/platform_role_test.go` — fail-closed untuk role tak dikenal

## N-37 — Bypass domain video (high)

**Akar masalah.** `SanitizeVideoURL` memakai `strings.Contains(host, "youtube.com")`.
Host yang *mengandung* string itu diterima, meski domain sebenarnya milik penyerang.

Vektor yang terbukti lolos **sebelum** perbaikan (tersimpan apa adanya di database):

| Input | Tersimpan |
|---|---|
| `https://youtube.com.evil.com/embed` | ya |
| `https://notyoutube.com.evil.com/x` | ya |
| `https://evil-youtu.be.attacker.net/x` | ya |

**Akar masalah kedua.** Rute `POST /api/fauna` memakai `productHandler.Store`,
**bukan** `faunaHandler.Store`. Handler produk memakai `security.SanitizeURL` yang
hanya memfilter skema (`javascript:`, `data:`) dan **tidak pernah** membatasi
domain. Jadi memperbaiki `fauna_handler.go` saja tidak berpengaruh — ini
terungkap justru karena verifikasi dilakukan lewat API, bukan hanya unit test.

**Perbaikan.** Pencocokan label domain utuh (`host == d` atau berakhiran `"."+d`)
untuk `youtube.com`, `youtube-nocookie.com`, `youtu.be`, `vimeo.com`. Skema
`javascript:`, `vbscript:`, `data:`, `file:`, `blob:` dan protokol-relatif
`//host` ditolak. File video langsung (`.mp4/.webm/.mov/.ogg/.m3u8`) tetap
diterima dari host mana pun karena dirender sebagai elemen `<video>`, bukan
iframe. Keempat titik tulis `video_url` kini memakai `SanitizeVideoURL`.

**Dampak XSS: terbatas, dan ini harus dinyatakan apa adanya.** `VideoEmbed.tsx`
merender host tak dikenal sebagai `<a href target="_blank" rel="noopener noreferrer">`,
bukan iframe. `youtube.com.evil.com` juga tidak dikanalikan sebagai YouTube
kerena percabangan memakai `startsWith`/`includes`, bukan cocok domain. Jadi
temuan ini adalah **kegagalan validasi domain**, bukan XSS. Ia menjadi serius
bila kelak render diubah menjadi iframe.

**Verifikasi runtime (server PID 31716, binary dibangun ulang):**

| Input | `video_url` tersimpan |
|---|---|
| `https://youtube.com.evil.com/embed` | `<DIBUANG>` |
| `https://notyoutube.com.evil.com/x` | `<DIBUANG>` |
| `https://evil-youtu.be.attacker.net/x` | `<DIBUANG>` |
| `https://www.youtube.com/watch?v=abc123` | tersimpan (kontrol positif) |
| `https://cdn.contoh.com/klip.mp4` | tersimpan (kontrol positif) |

## N-38 — NaN/Inf diterima sebagai user ID (medium)

Konversi `float64 → uint` di Go pada amd64 mengubah `NaN` dan `+Inf` menjadi
`9223372036854775808`, tanpa error. Sebelum perbaikan:

```
NaN  -> id=9223372036854775808 ok=true
+Inf -> id=9223372036854775808 ok=true
0.5  -> id=0 ok=true
```

String angka raksasa juga membungkus ke nilai kecil yang tampak sah.

Perbaikan: wajib bilangan bulat, bukan NaN/±Inf, dalam jangkauan `uint`, dan
penjagaan overflow pada konversi string. Kontrol positif `4294967295` tetap
terbaca.

## Yang belum diuji / batas kejujuran

- **`handlers` (0.4%) dan `services` (0.8%) masih nyaris tanpa test.** Angka
  coverage keseluruhan hanya naik tipis. Logika bisnis terbesar — yang justru
  paling berisiko — belum tersentuh.
- `-race` tetap hanya terbukti di CI (Windows lokal tanpa cgo).
- Perbaikan `video_url` diverifikasi pada jalur `products`; jalur lain yang
  menulis `video_url` (bila ada di masa depan) harus memakai helper yang sama.
- N-37 tidak dieksploitasi lebih jauh menjadi bukti XSS karena render frontend
  tidak memakai iframe — klaim XSS sengaja **tidak** dibuat.
