# Deployment & Hardening — Catavor / DFauna

Checklist untuk menjalankan sistem ini di production. Ditulis berdasarkan kode
aktual (commit `a111118`), bukan asumsi.

---

## 1. Yang sudah ditegakkan kode (fail closed)

Server **menolak start** bila salah satu terlanggar — bukan sekadar warning:

| Guard | Perilaku | Lokasi |
|---|---|---|
| `JWT_SECRET` default atau < 32 karakter | `log.Fatal` di production/staging | `config/config.go:106` |
| `DB_SSLMODE=disable` di production/staging | `log.Fatal` | `config/config.go:122` |
| Redis tidak tersedia di production | fail closed (token blacklist & rate limit butuh Redis) | `database/redis.go` |
| `JWT_EXPIRATION_HOURS > 24` di production/staging | `log.Fatal` (disarankan 12) | `config/config.go:88` |
| `ALLOWED_ORIGINS` wildcard saat credentials aktif | ditolak | `middleware/security.go:79` |

Verifikasi manual:

```bash
# harus GAGAL start
APP_ENV=production JWT_SECRET=***REMOVED*** \
  DB_SSLMODE=require ./catavor-server.exe
```

---

## 2. Variabel environment minimum untuk production

```dotenv
APP_ENV=production
APP_URL=https://app.example.com
PORT=8000

# Wajib: acak, minimal 32 karakter
JWT_SECRET=<openssl rand -hex 32>
JWT_EXPIRATION_HOURS=12

# Database — TLS wajib
DB_HOST=<host>
DB_PORT=5432
DB_NAME=catavor
DB_USER=<user>
DB_PASSWORD=<password>
DB_SSLMODE=require        # atau verify-full bila CA tersedia

# Redis — wajib di production
REDIS_ADDR=<host>:6379
REDIS_PASSWORD=<password>

# CORS — origin eksplisit, BUKAN wildcard
ALLOWED_ORIGINS=https://app.example.com

# Opsional: TLS langsung dari proses (bila tanpa reverse proxy)
# TLS_CERT_FILE=/etc/ssl/certs/fullchain.pem
# TLS_KEY_FILE=/etc/ssl/private/privkey.pem
```

Generate secret:

```bash
openssl rand -hex 32
```

---

## 3. Health probe — sudah tersedia

| Endpoint | Arti | Dipakai untuk |
|---|---|---|
| `GET /healthz` | proses hidup (tidak menyentuh DB) | liveness probe — jangan restart karena DB sekarat |
| `GET /readyz` | DB benar-benar bisa di-ping | readiness probe — hentikan trafik bila 503 |

Keduanya tanpa auth dan tanpa detail internal (tidak membocorkan versi/DSN).

```bash
curl -f http://localhost:8000/healthz   # {"status":"ok","uptime":"11s"}
curl -f http://localhost:8000/readyz    # {"status":"ready"} atau 503
```

Contoh konfigurasi orchestrator:

```yaml
livenessProbe:
  httpGet: { path: /healthz, port: 8000 }
  initialDelaySeconds: 10
  periodSeconds: 30
readinessProbe:
  httpGet: { path: /readyz, port: 8000 }
  initialDelaySeconds: 5
  periodSeconds: 10
```

---

## 4. TLS

Dua pilihan, keduanya didukung:

**A. Reverse proxy (disarankan)** — nginx/Caddy/ALB menerminasi TLS, upstream HTTP
ke `127.0.0.1:8000`. Biarkan `TLS_CERT_FILE` kosong.

**B. TLS langsung dari proses** — isi `TLS_CERT_FILE` dan `TLS_KEY_FILE`, server
otomatis memakai `ListenTLS`. Log start akan menampilkan `tls=true` dan skema
`https://`.

Header `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
sudah dikirim (`middleware/security.go:60`). **Jangan aktifkan preload** sebelum
yakin seluruh subdomain selalu HTTPS — preload sulit dibatalkan.

---

## 5. Backup database

`scripts/backup-db.sh` — format custom `pg_dump`, terkompresi, dengan verifikasi
dan rotasi retensi.

```bash
BACKUP_DIR=/var/backups/catavor BACKUP_RETAIN=14 ./scripts/backup-db.sh
```

Perilaku yang sudah diuji:

| Skenario | Hasil |
|---|---|
| Backup normal | 345K, `pg_restore --list` membaca 431 TOC entries |
| Database tidak ada | exit 1, **nol file** ditinggalkan (tidak ada backup palsu) |
| Rotasi, 5 file, retain 2 | 3 file terlama dihapus, 2 tersisa |
| Dump < 1 KB | dianggap rusak, exit 1 |

Jadwalkan harian (cron):

```cron
0 2 * * * cd /srv/catavor && BACKUP_DIR=/var/backups/catavor ./scripts/backup-db.sh >> /var/log/catavor-backup.log 2>&1
```

**Yang belum ada (perlu keputusan operasional):**
- Backup off-site (S3/rsync ke host lain). Backup di mesin yang sama tidak
  menolong bila disknya mati.
- Uji restore berkala. Backup yang tidak pernah di-restore belum terbukti.
- Enkripsi backup at-rest (usia `age` atau `gpg`).

---

## 6. WAF / rate limiting

**Sudah ada di aplikasi:**

| Limiter | Batas | Cakupan |
|---|---|---|
| `GlobalAPIRateLimiter` | 300 req/menit per IP | seluruh grup `/api` |
| `AuthRateLimiter` | 20 req/menit per IP+path | login/register |
| `PublicSubmissionRateLimiter` | 15 req/menit per IP | komentar, laporan, telemetri |

**Belum ada:** WAF layer 7 (deteksi payload/SQLi/XSS signature, geo-blocking,
bot management). Itu di luar aplikasi — pilih salah satu:

- Cloudflare / AWS WAF / GCP Cloud Armor di depan origin, atau
- ModSecurity + OWASP CRS pada nginx

Tanpa itu, aplikasi tetap terlindungi dari abuse volume, tapi tidak dari
serangan bertarget dengan volume rendah.

---

## 7. Yang perlu diputuskan sebelum go-live

1. **Token masih dikembalikan di body response login** meski sudah ada cookie
   HttpOnly. Ini demi kompatibilitas klien lama. Langkah berikutnya: frontend
   membaca sesi dari cookie saja, lalu field `token` dihapus dari response.
2. **Rotasi `JWT_SECRET`** akan memaksa logout semua pengguna (token lama tidak
   valid). Rencanakan di jendela pemeliharaan.
3. **Backup off-site** dan **uji restore** — belum ada, lihat §5.
4. **WAF** — belum ada, lihat §6.
5. **Monitoring**: log terstruktur (zerolog) sudah JSON; belum ada alerting.
   Minimal: alert pada `SESI ANOMALI`, `/readyz` 503, dan lonjakan 401/429.
