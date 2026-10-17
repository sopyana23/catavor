# Perbaikan M2 — CSP: hapus `unsafe-eval`, ganti `unsafe-inline` dengan hash

**Tanggal**: 2026-10-16
**Baseline**: `security-audit-report-update.md`
**Status**: ✅ SELESAI & TERVERIFIKASI DI BROWSER

---

## Masalah

CSP sebelumnya:
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net ...
```

Dua kata kunci itu membuat CSP nyaris tidak berguna:
- **`'unsafe-inline'`** — script inline apa pun boleh jalan, termasuk yang disuntikkan penyerang.
- **`'unsafe-eval'`** — `eval()`, `new Function()`, string-as-code boleh dieksekusi.

Kombinasi ini fatal bersama **M1** (JWT di `localStorage`): XSS → baca token → ambil alih akun.

---

## Analisis sebelum mengubah

Diperiksa dulu agar tidak merusak aplikasi:

| Pertanyaan | Hasil |
|---|---|
| Source pakai `eval()` / `new Function()`? | **Tidak ada** — `unsafe-eval` bisa dibuang langsung |
| Ada script inline? | **1 per platform** (OAuth popup bridge di `index.html`) |
| Script inline bisa dipindah ke file? | Tidak praktis: harus jalan **sebelum** bundle, dan isinya berbeda per platform |
| `style` inline dipakai? | **Ya, ~2.700** (`style={{...}}` di React) → `style-src` tetap butuh `'unsafe-inline'` |

**Keputusan**: `unsafe-eval` dihapus total; `unsafe-inline` di `script-src` diganti
**hash SHA-256**. `style-src` dibiarkan (React inline style tidak bisa di-hash,
risikonya rendah — bukan jalur eksekusi kode).

---

## Implementasi

### 1. Hash dihitung runtime — `internal/middleware/csp.go` (baru)

```go
func SetCSPDistDirs(dirs ...string)   // dipanggil dari main.go
func scriptSrcHashes() string          // "    'sha256-...' 'sha256-...' "
func RefreshCSPHashes()                // rebuild setelah deploy asset baru
```

Cara kerja:
- Baca `index.html` dari setiap dist dir (desktop/tablet/mobile)
- Regex menangkap `<script>` **tanpa** atribut `src`
- Hitung `sha256` → base64 → format `'sha256-...'`
- Di-cache (sync.Once), dihitung sekali saat startup

**Kenapa runtime, bukan hardcode**: hash hardcode akan basi setiap kali
`index.html` diedit, dan CSP-nya akan memblokir app sendiri. Dengan menghitung
dari file yang benar-benar disajikan, hash selalu sinkron.

### 2. Wiring — `cmd/server/main.go`

```go
middleware.SetCSPDistDirs(cfg.DesktopDistDir, cfg.TabletDistDir, cfg.MobileDistDir)
middleware.SetupSecurityMiddlewares(app, cfg)
```

### 3. CSP baru — `internal/middleware/security.go`

```
script-src 'self' 'sha256-IN6gph...' 'sha256-J4sSst...' https://cdn.jsdelivr.net ...;
style-src  'self' 'unsafe-inline' https://fonts.googleapis.com;
object-src 'none'; base-uri 'self';
```

---

## Verifikasi

### Header aktual (server berjalan)

```
Content-Security-Policy: default-src 'self';
script-src 'self' 'sha256-IN6gphBMhU2B2AIwEcJRzuXDqErRLlw6OnXkGXh2k/k='
                   'sha256-J4sSstLQBDESKxPJBNrM0EXn2YLgD80mmmrnnhtTjGo='
                   https://cdn.jsdelivr.net ...;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ...
```

| Cek | Hasil |
|---|---|
| `unsafe-eval` di `script-src` | **hilang** ✅ |
| `unsafe-inline` di `script-src` | **hilang** ✅ |
| Hash terhitung | `hashes=2` (desktop + mobile) ✅ |

### Uji di browser nyata

| Halaman | Render | Console error | CSP violation |
|---|---|---|---|
| `/adidas` (desktop, 12 item) | penuh ✅ | **0** ✅ | **0** ✅ |
| `/iop/admin` (login + tombol Google OAuth) | penuh ✅ | **0** ✅ | **0** ✅ |
| `/adidas?view=mobile` (mobile, 12 item) | penuh ✅ | **0** ✅ | **0** ✅ |

Script inline OAuth bridge tetap jalan (diizinkan lewat hash), sementara script
suntikan dari luar tidak akan jalan.

### Build

```
go build ./...   → exit 0
go vet ./internal/middleware/ ./cmd/server/ → exit 0
```

---

## Dampak & catatan operasional

1. **Setiap kali `index.html` berubah, hash berubah** — karena dihitung saat
   startup, cukup restart server (tidak perlu edit kode). Bila ada mekanisme
   hot-reload asset tanpa restart, panggil `RefreshCSPHashes()`.
2. **Script inline baru** (mis. menambah snippet analytics inline) akan
   **diblokir** sampai restart / `RefreshCSPHashes()`. Ini perilaku yang benar:
   CSP ketat memaksa script inline terdaftar.
3. **`style-src` masih `'unsafe-inline'`** — konsekuensi React inline style.
   Bukan jalur eksekusi kode; risiko terbatas pada CSS injection.
4. Belum diuji di **WebKit/Safari** (hash CSP didukung semua browser modern,
   tapi perilaku OAuth popup sebaiknya di-smoke-test manual di Safari/iOS).

---

## Status temuan audit

| ID | Item | Status |
|---|---|---|
| H1, H2 | HIGH | ✅ FIXED |
| M2 | **CSP** | ✅ **FIXED** |
| M3, M4 | MED | ✅ FIXED |
| L1–L6 | LOW | ✅ FIXED |
| M1 | JWT di localStorage | ⬜ **satu-satunya yang tersisa** |

**Progress: 11 dari 12 tertutup.**
