# Catavor E2E (Playwright)

Suite end-to-end untuk desktop + mobile (Pixel 5). Menjalankan UI sungguhan
terhadap server yang hidup di `http://localhost:8000`.

## Prasyarat

1. PostgreSQL + Redis hidup, `backend/.env` valid.
2. Server berjalan:
   ```bash
   cd backend && go build -o tmp-server.exe ./cmd/server && ./tmp-server.exe
   ```
   Cek: `curl http://localhost:8000/healthz` → `{"status":"ok"}`
3. Fixture DB (idempoten, aman diulang):
   ```bash
   cd backend
   go run ./cmd/seed-e2e      # store "adidas" + merchant e2e-admin + store "e2e-store"
   go run ./cmd/seed_adidas   # 5 item katalog untuk store "adidas"
   ```
4. Dependensi: `cd tests && npm install`

## Menjalankan

```bash
cd tests

# suite penuh — 30 test, 0 skip (butuh kredensial untuk 6 test auth)
CATAVOR_ADMIN_EMAIL=e2e-admin@catavor.test \
CATAVOR_ADMIN_PASSWORD='E2eTest!2026' \
npm run test:e2e
```

Tanpa env var, 6 test di `session-from-token` dan `task-31-idle-resync`
otomatis di-`skip` (bukan gagal) — suite jadi 24 test. Itu perilaku yang
disengaja: test auth butuh akun nyata.

Kredensial di atas **bukan rahasia**, hanya fixture DB lokal/CI yang dibuat
oleh `backend/cmd/seed-e2e`. Jangan dipakai di produksi.

## Cakupan

| Spec | Yang dikunci |
|---|---|
| `device-sanity` | viewport sesuai device, UI key on-screen, model interaksi touch/click |
| `history-back` | back-button trap: klik item → detail, back tidak bounce forward, Back×5 stabil |
| `session-from-token` | refresh admin dengan `catavor_stores` kosong tidak terlempar ke `/catalogs`; slug milik merchant lain ditolak 403/404 |
| `task-31-idle-resync` | idle pendek tidak resync; idle >5 menit memicu `/api/auth/verify` + notifikasi |
| `task-21-effect-cleanup` | tidak ada `useEffect` ber-resource tanpa cleanup di App.tsx desktop & mobile |
| `client-telemetry` | crash report klien terkirim, halaman tetap utuh (resilience) |

## Catatan

- `workers: 1`, `fullyParallel: false` — sengaja, agar tidak menabrak
  `AuthRateLimiter` dan agar urutan history-stack deterministik.
- Test panel admin login-UI dihapus karena flaky (rate limiter); jalur sesi
  admin dikunci lewat `session-from-token` yang memakai token langsung.
- `baseURL` hardcode `localhost:8000`; ubah di `playwright.config.ts` bila
  port berbeda.
