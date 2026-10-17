# M1 Penuh — JWT di Cookie HttpOnly + CSRF + Autentikasi SSE

**Tanggal**: 2026-10-17
**Baseline**: `security-audit-report-update.md` (M1 = MEDIUM, terakhir tersisa)
**Status**: ✅ SELESAI & TERVERIFIKASI RUNTIME

---

## 1. Masalah

M1 adalah temuan terakhir yang tersisa. JWT disimpan di `localStorage` dan
dikirim sebagai `Authorization: Bearer`, artinya skrip apa pun yang berjalan di
halaman (XSS) bisa membaca token dan memakainya dari mesin lain selama 12 jam
penuh — tanpa refresh token, tidak ada cara memperpendek.

Mitigasi A (`mitigasi-m1.md`) sudah memotong umur token 72 → 12 jam dan
menambahkan deteksi anomali IP/UA, tetapi akar masalahnya tetap: token bisa
dibaca JavaScript.

Pekerjaan ini menutup akarnya dalam tiga bagian:

| Bagian | Masalah | Perbaikan |
|--------|---------|-----------|
| Cookie | Token di `localStorage`, terbaca XSS | Pindah ke cookie `HttpOnly` |
| CSRF | Cookie terkirim otomatis | `SameSite=Strict` + validasi Origin |
| SSE | `EventSource` tak bisa kirim header → JWT di URL | Tiket sekali pakai 30 detik |

---

## 2. Cookie HttpOnly

`backend/internal/handlers/session_cookie.go`

- Login/refresh menulis `catavor_session` dengan `HttpOnly`, `SameSite=Strict`,
  `Path=/`, `Secure` (kecuali local), dan `MaxAge` sesuai umur token.
- Logout menghapus cookie.
- Middleware membaca kredensial berurutan: cookie → `Authorization` → query.
  — Cookie lebih dulu, jadi klien yang sudah menulis token ke `localStorage`
  tetap jalan (kompatibilitas), tetapi tidak lagi jadi jalur utama.

**Catatan desain:** `Authorization` dan `?token=` dipertahankan sebagai fallback
kompatibilitas. Kalau nanti semua klien sudah pindah, keduanya bisa dihapus.

---

## 3. CSRF — lapisan kedua

`backend/internal/middleware/csrf.go` (+ `csrf_test.go`, 13 kasus)

`SameSite=Strict` saja dianggap cukup oleh banyak orang, tetapi ia runtuh bila
ada subdomain yang bisa dikendalikan penyerang, browser lama, atau bug parser.
Middleware ini menambah lapisan kedua:

- Menolak `POST/PUT/PATCH/DELETE` bila `Origin` (fallback `Referer`) bukan milik kita.
- `Origin: null` ditolak (sandbox iframe, `file://`).
- **Klien non-browser tanpa cookie tetap lolos** — health probe, curl, cron.
  Tanpa pengecualian ini, uptime monitoring akan mulai menerima 403.
- `GET/HEAD/OPTIONS` tidak disentuh (read-only).
- Respons `403 {"code":"CSRF_REJECTED"}` + log WARN.

---

## 4. Autentikasi SSE — tiket sekali pakai

`backend/internal/security/sse_ticket.go` (+ test), `sse_ticket_auth`, rute
`POST /api/notifications/ticket` di `cmd/server/main.go`.

**Sebelum:** `new EventSource('/api/notifications/stream?token=<JWT>')`.
JWT berumur 12 jam masuk URL → access log, header `Referer`, riwayat browser,
cache proxy. Token di log = sama buruknya dengan tidak mengunci apa pun.

**Sesudah:** klien menukar sesi cookie dengan tiket via `POST
/api/notifications/ticket`, lalu membuka `?ticket=...`.

- 32 byte acak (`crypto/rand`), base64url.
- **Sekali pakai** — dihapus dari map saat dikonsumsi.
- Umur 30 detik.
- Maksimal 8 tiket hidup per user (cegah penumpukan memori).
- Respons `Cache-Control: no-store`.
- Tiket membangun ulang konteks user dari DB dengan aturan sama seperti jalur
  JWT: akun yang diblokir setelah tiket terbit tetap ditolak.

### Bug yang ditemukan saat verifikasi

Verifikasi runtime menangkap bug nyata di implementasi pertama: replay tiket
mengembalikan **200**, bukan 401.

**Sebab:** middleware memvalidasi tiket lalu `return nil` (lolos), tetapi
`return nil` tidak menghentikan rantai — handler SSE tetap jalan dan backend
memvalidasi sendiri lewat **cookie** yang masih sah. Akibatnya jaminan "sekali
pakai" palsu selama cookie hidup.

**Perbaikan:** bila `?ticket=` ada, tiket adalah **satu-satunya** kredensial.
Cookie sengaja tidak dipakai sebagai cadangan. Middleware langsung `c.Next()`
setelah membangun konteks dari tiket, dan menolak 401 bila tiket tidak sah.

### Temuan ketiga: stream kedua yang terlewat

Pemeriksaan bundle produksi (bukan hanya source) mengungkap bahwa
`?token=` **masih ada di bundle** meski `App.tsx` sudah bersih. Penyebabnya:
`components/PlatformRolePortal.tsx` di desktop dan mobile punya **koneksi SSE
kedua** untuk portal support/compliance yang juga membawa JWT di URL.

Pencarian awal hanya menyapu `App.tsx` — itu kelalaian, dan hanya tertangkap
karena bundle ikut diperiksa. Keduanya sudah diperbaiki dan kini memakai tiket.
Verifikasi akhir: `stream?token=` = **0** di sumber maupun bundle aktif.

### Temuan keempat: bundle yatim di direktori statis

`public/desktop/assets` dan `public/mobile/assets` menyimpan bundle hasil build
lama yang tidak lagi dirujuk `index.html` namun **tetap disajikan** oleh
`app.Static("/desktop", ...)`. Dua di antaranya masih memuat JWT-di-URL,
sehingga kode rentan bisa diambil langsung lewat URL selama file itu ada.
Bundle yatim (`.js` dan `.fiber.gz`) sudah dihapus; `index.html` dan bundle
aktif kini sinkron dan bersih.

---

## 5. Verifikasi

### Unit test (permanen, ada di repo)

```
go test ./internal/security/
  TestSSETicketSingleUse      PASS
  TestSSETicketUnknown        PASS
  TestSSETicketEntropy        PASS   (32 byte, base64url, unik)
  TestSSETicketPerUserCap     PASS
  TestSSETicketIsolation      PASS
  TestSSETicketConcurrent     PASS   (32 goroutine, tepat 1 sukses)
  TestUserIDFromLocals        PASS
ok  catavor-backend/internal/security

go test ./internal/middleware/   ok  (13 kasus CSRF)
go build ./...                   0
go vet                           0
```

**Bug kedua ditemukan oleh unit test ini:** `UserIDFromLocals(uint(0))`
mengembalikan `true`, padahal user id 0 tidak sah. Sudah diperbaiki — tiket
tidak bisa terbit untuk identitas kosong.

### Runtime (server hidup, probe ad-hoc)

```
loginOk                 true
cookieOk                true
ticketWithoutSession401 true     tanpa sesi tak bisa minta tiket
ticketStatus            200
ticketIssued            true     43 char base64url
cacheNoStore            true
firstUse                200      tiket sah membuka stream
replayWithCookie        401      ← bug yang diperbaiki
replayWithoutCookie     401
bogusTicketWithCookie   401      cookie tak menyelamatkan tiket palsu
```

### Frontend

```
tsc -b desktop   0
tsc -b mobile    0
vite build       0 (keduanya)
grep 'stream?token=' → 0 hasil (seluruh source, bukan hanya App.tsx)
bundle aktif  → stream?token= 0, stream?ticket= 2, endpoint tiket 2
bundle yatim  → tidak ada (yang tersisa = yang dirujuk index.html)
curl bundle lama → 404/SPA fallback, tidak lagi menyajikan kode rentan
```

### E2E Playwright

```
24 passed, 6 skipped, 0 failed
```

---

## 6. Sisa risiko (jujur)

1. **Fallback `?token=` masih ada** untuk klien lama. Selama ada, jalur bocor
   lewat URL belum sepenuhnya mati. Klien web sudah tidak memakainya.
2. **Tiket disimpan in-memory** — tidak bertahan restart dan tidak dibagi antar
   instance. Untuk deployment multi-instance perlu Redis (perhatikan M3:
   Redis sudah fail-closed di production).
3. **`style-src 'unsafe-inline'`** tetap ada karena React inline style.
4. **25 CVE Go stdlib** tersisa — butuh Go ≥1.26.2 di CI; upgrade lokal gagal
   (`Access is denied` pada `compile.exe`).

---

## 7. Kesimpulan

M1 tertutup pada akarnya: token tidak lagi terbaca JavaScript, cookie terlindungi
dari CSRF berlapis, dan stream tidak lagi membawa JWT di URL.

Dua bug nyata ditemukan justru **oleh verifikasi**, bukan oleh review kode —
replay tiket yang lolos karena cookie, dan `user_id = 0` yang dianggap sah.
Keduanya sudah diperbaiki dan dikunci dengan test.
