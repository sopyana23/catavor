# Kesiapan Produksi — Penilaian Putaran 6

**Tanggal:** 2026-10-18
**Pertanyaan:** Apakah aplikasi siap naik produksi dan memenuhi standar industri?
**Jawaban singkat:** **Belum.** Keamanan aplikasi sudah baik, tetapi kesiapan
operasional belum.

---

## 1. Yang sudah memenuhi standar

### Kontrol keamanan (terbukti runtime)

| Kontrol | Status | Bukti |
|---|---|---|
| 39 temuan audit putaran 6 | tertutup | `findings.json` |
| Read-IDOR sweep (42 handler) | 0 IDOR | `read-idor-sweep.md` |
| Security header | lengkap | `runtime-headers-cors.md` |
| CORS | menolak origin asing | `runtime-headers-cors.md` |
| HSTS | aktif saat HTTPS | guard `c.Secure()` |
| CSRF | aktif | N-30 |
| JWT (iss/aud/alg) | divalidasi | N-36 |
| Secret di git history | 0 commit | `git-history-rewrite.md` |
| `govulncheck` | **0 reachable** | dijalankan 2026-10-18 |
| `npm audit` desktop & mobile | **0 vulnerabilities** | dijalankan 2026-10-18 |
| `go vet` | bersih | dijalankan 2026-10-18 |
| Unit test | **31 test, semua lulus** | dijalankan 2026-10-18 |

### Fail-closed guard (terbukti runtime)

Server menolak start bila konfigurasi produksi tidak aman:

| Skenario | Hasil |
|---|---|
| `APP_ENV=production` + `DB_SSLMODE=disable` | **exit 1** — "koneksi database harus terenkripsi" |
| `APP_ENV=staging` + `DB_SSLMODE=disable` | **exit 1** |
| `APP_ENV=production` + JWT_SECRET < 32 char | **exit 1** — "JWT_SECRET terlalu pendek" |
| `APP_ENV=production` + `sslmode=require` + DB tanpa TLS | **exit 1** — "server refused TLS" (benar: DB-nya belum TLS) |

Ini pola yang tepat: salah konfigurasi produksi berakibat server mati, bukan
jalan dengan pengamanan longgar.

---

## 2. Yang BELUM siap produksi

### A. Cakupan test sangat rendah — BLOCKER

| Paket | Coverage |
|---|---|
| `internal/handlers` | **0.4%** |
| `internal/services` | **0.8%** |
| `internal/config` | **0.0%** |
| `internal/database` | **0.0%** |
| `internal/models` | **0.0%** |
| `internal/middleware` | 6.8% |
| `internal/security` | 28.9% |

34.532 baris kode dilindungi **31 test**. Seluruh logika bisnis di
`handlers` (13.000+ baris) praktis tidak teruji otomatis.

Konsekuensi nyata: setiap perubahan bisa merusak fitur tanpa terdeteksi.
Perbaikan keamanan yang sudah dikerjakan pun bisa mundur diam-diam.

**Standar industri:** minimum 60–80% untuk logika bisnis, plus integration
test untuk alur kritis.

### B. CI tidak melakukan build maupun test — BLOCKER

`.github/workflows/security-audit.yml` hanya menjalankan **gitleaks**.

Tidak ada:
- `go build` — kode yang tidak bisa dikompilasi tetap lolos
- `go test` — regresi tidak tertangkap
- `go vet`
- typecheck frontend
- build frontend

Artinya: seluruh verifikasi yang saya lakukan di sesi ini **manual dan tidak
akan terulang otomatis**. Ini risiko regresi paling besar saat ini.

### C. Node.js di bawah pin

`.nvmrc` dan `engines` menetapkan `>=22.13.0`, mesin build masih **20.13.1**
(EBADENGINE). Build produksi belum diuji pada versi yang diwajibkan.

### D. Belum ada deployment pipeline

Tidak ditemukan Dockerfile, docker-compose, atau workflow deploy. Rilis masih
manual: build biner, salin, restart. Tidak ada:
- migrasi DB otomatis saat rilis
- rollback teruji
- healthcheck gate
- strategi downtime/zero-downtime

Catatan: `DB_AUTO_MIGRATE=false` + `SKIP_DB_MIGRATE=true` — migrasi manual via
`backend/migrations/*.sql`. Ini bisa diterima, tetapi butuh prosedur rilis
tertulis dan teruji.

### E. Observability minim

`SENTRY_DSN` kosong. Log terstruktur (zerolog) sudah ada, tetapi tidak ada
error tracking terpusat, metrik, atau alerting. Bila produksi bermasalah,
tidak ada yang memberi tahu.

### F. Belum ada pentest pihak ketiga

Audit ini adalah **self-assessment**. Titik buta penulis kode tidak bisa
dilihat oleh penulis kode itu sendiri.

### G. N-13/N-14 belum terbukti end-to-end

Perbaikan `email_verified` pada Google OAuth sudah benar di source, tetapi
belum pernah dijalankan dengan ID token Google asli.

### H. HSTS belum terverifikasi di HTTPS nyata

Terbukti benar pada HTTP (tidak dikirim). Pada HTTPS produksi belum diuji.

---

## 3. Rekomendasi urutan kerja

Prioritas berdasarkan risiko, bukan kemudahan:

1. **CI: build + test + vet** — mencegah regresi. Ini yang paling mendesak
   karena melindungi semua perbaikan yang sudah ada.
2. **Naikkan coverage `handlers`** — mulai dari alur kritis: auth, checkout,
   multi-tenant isolation.
3. **Node 22.13** di mesin build.
4. **Deployment pipeline** + prosedur migrasi & rollback teruji.
5. **Error tracking** (Sentry atau serupa) + alert.
6. **Pentest pihak ketiga** sebelum klaim "aman" ke publik.

---

## Kesimpulan

**Keamanan aplikasi: baik.** 39 temuan tertutup dengan bukti runtime, sweep
IDOR bersih, dependency bersih, guard konfigurasi fail-closed.

**Kesiapan produksi: belum.** Tiga blocker: cakupan test 0.4% pada logika
bisnis, CI tanpa build/test, dan tidak adanya pipeline rilis dengan rollback
teruji.

Menjalankan aplikasi ini di produksi hari ini berarti setiap rilis adalah
taruhan — bukan karena kodenya tidak aman, tetapi karena tidak ada jaring yang
menangkap bila ada yang rusak.
