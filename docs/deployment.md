# Deployment & Rollback — Catavor

Dokumen ini adalah prosedur operasional. Semua langkah ditulis agar bisa
dijalankan orang lain tanpa menebak.

---

## 1. Prasyarat produksi

### 1.1 Variabel lingkungan wajib

Saat `APP_ENV=production` (atau `staging`), aplikasi **menolak start** bila
variabel di bawah tidak memenuhi syarat. Ini diverifikasi runtime, bukan
asumsi:

| Variabel | Syarat yang dipaksakan | Pesan bila dilanggar |
|---|---|---|
| `JWT_SECRET` | wajib diisi, bukan nilai default lama yang bocor | `JWT_SECRET wajib di-set...` |
| `JWT_EXPIRATION_HOURS` | ≤ 24 | `> 24 jam tidak diizinkan...` |
| `DB_SSLMODE` | bukan `disable` / kosong | `DB_SSLMODE=disable tidak diizinkan...` |
| `ALLOWED_ORIGINS` | tanpa `localhost`/`127.0.0.1`/`0.0.0.0`, wajib `https://` | `ALLOWED_ORIGINS memuat alamat lokal...` |

Daftar lengkap nilai:

| Variabel | Nilai produksi | Catatan |
|---|---|---|
| `APP_ENV` | `production` | Mengaktifkan pemeriksaan ketat |
| `APP_URL` | `https://catavor.id` | Dipakai untuk URL absolut & `STORAGE_PUBLIC_URL` |
| `ALLOWED_ORIGINS` | `https://catavor.id` | **Jangan** biarkan default `localhost` — server **menolak start** bila masih lokal atau bukan `https://` |
| `JWT_SECRET` | 32+ byte acak | `openssl rand -base64 48`; **beda** dari lokal |
| `JWT_EXPIRATION_HOURS` | `12` | Perpendek bila perlu |
| `DB_HOST` / `DB_PORT` | host PostgreSQL | Port default `5432` |
| `DB_USER` / `DB_PASSWORD` | kredensial DB | Gunakan user khusus, bukan `postgres` |
| `DB_NAME` | `catavor` | |
| `DB_SSLMODE` | `require` (atau `verify-full`) | **Jangan** `disable` di produksi |
| `DB_AUTO_MIGRATE` | `false` | Migrasi manual (bagian 3) |
| `SKIP_DB_MIGRATE` | `true` | Sesuai `DB_AUTO_MIGRATE=false` |
| `STORAGE_DRIVER` | `s3` (disarankan) atau `local` | `local` = data hilang saat container diganti |
| `S3_*` | kredensial bucket | Wajib bila `STORAGE_DRIVER=s3` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | kredensial OAuth | `GOOGLE_REDIRECT_URI` = `$APP_URL/api/auth/google/callback` |
| `TRUSTED_PROXIES` | CIDR reverse proxy | Bukan `127.0.0.1` bila di belakang LB |
| `TLS_CERT_FILE` / `TLS_KEY_FILE` | kosong | Biarkan kosong bila TLS diterminasi di proxy |

> **Catatan jujur:** `SENTRY_DSN` belum ada di `config.go`, jadi menyetelnya
> saat ini **tidak berefek apa pun**. Lihat bagian 5.

### 1.2 Database

- PostgreSQL ≥ 14.
- Backup terverifikasi **sebelum** setiap rilis (`pg_dump -Fc`).
- User aplikasi tidak boleh superuser; cukup `SELECT/INSERT/UPDATE/DELETE` +
  hak tabel yang dimigrasikan.

---

## 2. Rilis

### 2.1 Membuat tag

```bash
git checkout dev
git pull
git tag -a v1.0.0 -m "Rilis 1.0.0"
git push origin v1.0.0
```

Tag memicu `.github/workflows/release.yml`:

1. `verify` — build, vet, `go test -race`, typecheck frontend, build frontend.
   **Bila gagal, image tidak dibangun.**
2. `image` — build multi-stage, push ke GHCR, pindai Trivy (CRITICAL/HIGH
   menggagalkan job), lampirkan SBOM & provenance.

Image: `ghcr.io/sopyana23/catavor:<versi>` dan `:sha-<sha7>`.

### 2.2 Menjalankan container

```bash
docker run -d --name catavor \
  --env-file /etc/catavor/production.env \
  -p 127.0.0.1:8000:8000 \
  -v /srv/catavor/storage:/data/storage \
  --restart unless-stopped \
  --read-only --tmpfs /tmp \
  ghcr.io/sopyana23/catavor:1.0.0
```

- `-p 127.0.0.1:8000` — jangan ekspos langsung; taruh di belakang reverse proxy
  yang menangani TLS.
- `--read-only` — image tidak perlu menulis selain `/data/storage` dan `/tmp`.
- Image berjalan sebagai `nonroot` (uid 65532), tanpa shell.

### 2.3 Verifikasi setelah rilis

```bash
curl -fsS https://catavor.id/healthz
curl -fsSI https://catavor.id/desktop/ | head -1
docker logs --tail 50 catavor
```

Wajib hijau: `/healthz` 200, `/desktop/` 200, log tanpa panic.

---

## 3. Migrasi database (manual)

`DB_AUTO_MIGRATE=false` berarti `AutoMigrate` dan seeder **tidak** berjalan.
Model baru **tidak otomatis menjadi tabel**. Urutan aman:

```bash
# 1. Backup — WAJIB
pg_dump -Fc -h $DB_HOST -U $DB_USER catavor > backup-$(date +%Y%m%d-%H%M%S).dump

# 2. Uji migrasi di database salinan dulu
createdb -h $DB_HOST -U $DB_USER catavor_staging
pg_restore -h $DB_HOST -U $DB_USER -d catavor_staging backup-*.dump
psql -h $DB_HOST -U $DB_USER -d catavor_staging -v ON_ERROR_STOP=1 -f migrations/xxx.sql

# 3. Bila bersih, jalankan ke produksi
psql -h $DB_HOST -U $DB_USER -d catavor -v ON_ERROR_STOP=1 -f migrations/xxx.sql
```

**Penting:** di PostgreSQL, satu pernyataan gagal membatalkan **seluruh
transaksi** (`25P02`). Jangan menjalankan file migrasi sebagai satu transaksi
raksasa tanpa `ON_ERROR_STOP=1`; perbaiki dulu, lalu ulangi dari awal.

Urutan rilis yang benar: **migrasi dulu (kompatibel mundur) → deploy kode →
hapus kolom lama di rilis berikutnya.** Jangan pernah deploy kode yang membaca
kolom yang belum ada.

---

## 4. Rollback

### 4.1 Rollback aplikasi (tanpa perubahan skema)

```bash
docker stop catavor && docker rm catavor
docker run -d --name catavor \
  --env-file /etc/catavor/production.env \
  -p 127.0.0.1:8000:8000 \
  -v /srv/catavor/storage:/data/storage \
  --restart unless-stopped \
  --read-only --tmpfs /tmp \
  ghcr.io/sopyana23/catavor:<versi-sebelumnya>
curl -fsS https://catavor.id/healthz
```

Gunakan tag versi atau `sha-<sha7>`, **bukan** `latest` — `latest` bergerak
mengikuti rilis sehingga rollback tidak deterministik.

### 4.2 Rollback database

Hanya bila migrasi merusak data:

```bash
docker stop catavor
pg_restore -h $DB_HOST -U $DB_USER -d catavor --clean --if-exists backup-*.dump
docker start catavor
```

`--clean --if-exists` menghapus objek yang ada lebih dulu. **Ini kehilangan
data yang masuk setelah backup** — karena itu backup wajib dilakukan sebelum
migrasi, bukan sesudah.

### 4.3 Kriteria keputusan

| Gejala | Tindakan |
|---|---|
| `/healthz` gagal, log panic | Rollback aplikasi segera |
| Error 5xx masif setelah deploy | Rollback aplikasi |
| Data korup / kolom hilang | Rollback aplikasi **+** restore DB |
| Sekadar lambat | Jangan rollback; ukur dulu |

---

## 5. Kesenjangan yang diketahui

Dinyatakan apa adanya, bukan sebagai "sudah beres":

1. **`SENTRY_DSN` tidak ada di `config.go`.** Belum ada integrasi Sentry.
   Menyetel variabel ini tidak melakukan apa pun sampai kode ditambahkan.
2. **Tidak ada healthcheck di dalam image.** Image distroless tidak punya
   shell/curl, jadi `HEALTHCHECK` tidak bisa memakai keduanya. Pemantauan
   bergantung pada orchestrator yang memanggil `/healthz`.
3. **`STORAGE_DRIVER=local` kehilangan unggahan** saat container diganti.
   Untuk produksi gunakan `s3` atau mount volume permanen.
4. **Belum ada uji beban.** Batas laju (login 15–20/menit, OTP ~25 detik)
   diverifikasi secara fungsional, belum diukur di bawah beban nyata.
5. **Migrasi belum punya pelacak versi.** Belum ada tabel
   `schema_migrations`; urutan file harus dijaga manual.
