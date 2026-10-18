# Verifikasi Runtime — Headers, CORS, HSTS

**Tanggal:** 2026-10-18
**Target:** `http://127.0.0.1:8000` (server lokal, APP_ENV=local)
**Metode:** pembacaan header response langsung dari server yang berjalan

## Security headers

Diambil dari `GET /healthz`:

| Header | Nilai |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=()` |
| `Content-Security-Policy` | ada, `default-src 'self'`, `object-src 'none'`, `base-uri 'self'` |
| `Strict-Transport-Security` | **tidak dikirim di HTTP** — lihat catatan |

### Catatan HSTS

HSTS sengaja hanya dikirim saat koneksi HTTPS
(`internal/middleware/security.go:58–61`, guard `c.Secure()`), dengan nilai
`max-age=31536000; includeSubDomains; preload`.

Ini perilaku yang benar: mengirim HSTS lewat HTTP tidak berguna karena browser
mengabaikannya, dan pada saat development justru bisa membuat `localhost`
terpaku ke HTTPS. **Perlu dikonfirmasi sekali di produksi** bahwa header benar
muncul saat diakses via HTTPS.

### Catatan CSP

CSP memuat banyak domain pihak ketiga (Google Tag Manager, DoubleClick,
TikTok, Instagram, Google Analytics). Ini konsekuensi dari fitur analitik dan
embed sosial, bukan kelalaian. `object-src 'none'` dan `base-uri 'self'`
membatasi dampak bila ada injeksi. `style-src` masih memakai
`'unsafe-inline'` — risiko rendah untuk XSS modern (butuh `script-src`, yang
sudah dibatasi).

## CORS

| Uji | Hasil |
|---|---|
| `Origin: https://evil.example.com` | **tidak** mendapat `Access-Control-Allow-Origin` |
| `Origin: http://127.0.0.1:8000` (sah) | `Access-Control-Allow-Origin: http://127.0.0.1:8000` + `Allow-Credentials: true` |

Origin asing ditolak dengan benar; origin sah diizinkan dengan credentials.
Tidak ada wildcard `*` yang dipadukan dengan credentials (kombinasi terlarang
yang membuka pencurian data lintas-origin).

## Yang belum diverifikasi

- HSTS pada kondisi HTTPS nyata (butuh deployment TLS).
- Perilaku CORS pada domain produksi `catavor.id` (diuji dengan origin lokal).
