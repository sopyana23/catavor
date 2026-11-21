# Graphify — Setup & Batasan (terukur)

Terakhir diukur: commit `ad25a7b`, 21 Nov 2026, mesin dev lokal (Windows, git-bash).

## Yang aktif

**Hanya graph backend.** Frontend sengaja tidak di-extract.

```bash
export PATH="$HOME/.local/bin:$PATH"

# Sekali saja (butuh extra [postgres] + [sql]): pasang dependensi opsional
python -m uv tool install "graphifyy[postgres,sql]"

# Build/refresh penuh — sertakan schema Postgres live
cd backend
PW=$(grep '^DB_PASSWORD=' .env | cut -d= -f2- | tr -d '\r')
graphify extract . --code-only --force \
  --postgres "postgres://postgres:${PW}@127.0.0.1:5432/catavor?sslmode=disable"

# Update inkremental setelah ubah kode Go
graphify update .

# Regenerasi GRAPH_REPORT.md
graphify cluster-only .
```

Hasil backend: **2.151 node · 12.706 edge · 75 komunitas**,
92% EXTRACTED / 8% INFERRED (avg confidence 0.84), biaya token build **0**.

Rincian sumber node: 2.012 AST (Go) · 83 concept · **56 PostgreSQL** · 139 Go package stub.

## Schema Postgres ikut ter-graph

`--postgres` membaca schema **live** (bukan file migrasi) dan menghasilkan
56 node tabel/view + 123 edge, termasuk foreign key.

**Diverifikasi silang** — pertanyaan "tabel mana yang FK ke `users`":

| Sumber | Hasil |
|:---|:---|
| `psql` langsung ke Postgres | 13 tabel |
| graphify | 13 tabel |
| Cocok persis | **ya, nol selisih dua arah** |

Contoh jawaban graph (semua `EXTRACTED`, bukan tebakan):

```
"public"."two_factor_recovery_tickets" --references--> "public"."users"
"public"."user_sessions"               --references--> "public"."users"
"public"."mfa_account_lockouts"        --references--> "public"."users"
```

### Batasan `--postgres`

1. **Hanya tabel + FK + view + routine.** Kolom sengaja dibuang —
   `pg_introspect.py` membuat stub `CREATE TABLE x (id INT)` lalu
   menambahkan constraint lewat `ALTER TABLE`. Jadi jangan harap graph bisa
   menjawab "tipe kolom apa" atau "kolom mana yang nullable".
2. **Node dicari lewat id, bukan label.** Label-nya ber-quote
   (`"public"."user_two_factor_auth"`), dan `graphify explain` butuh id:

   ```bash
   # SALAH — "No node matching"
   graphify explain '"public"."two_factor_recovery_tickets"'

   # BENAR
   graphify explain "postgresql_127_0_0_1_catavor_public_two_factor_recovery_tickets"
   ```
3. **DSN terlihat di proses list.** `--postgres` menerima URL lengkap dengan
   password. Jangan jalankan di mesin bersama; baca password dari `.env`,
   jangan hardcode.

## File migrasi `.sql`: hanya file DDL murni yang ter-parse

Dari 11 file migrasi, **8 menghasilkan node** (69 total) dan **3 hanya
menghasilkan node file** tanpa isi:

| File | Node |
|:---|---:|
| `n58_create_advertising_and_trending_tables` | 20 |
| `n60_user_two_factor_auth` | 16 |
| `n56_catalog_popularity_and_store_metrics` | 11 |
| `n59_enterprise_store_analytics_dimensions` | 7 |
| `n57_payment_system_enhancements` | 5 |
| `n26_store_daily_traffic_sources` | 3 |
| `n53_master_categories` | 2 |
| `n55_master_presets` | 2 |
| `n45b_dedupe_foreign_keys_guarded` | **1** |
| `n51_add_missing_foreign_keys` | **1** |
| `n52b_drop_faunas_table_guarded` | **1** |

Penyebab 3 file terakhir: semuanya memakai **`DO $$ ... DECLARE ... END $$`**
(PL/pgSQL prosedural). `tree-sitter-sql` hanya memahami SQL deklaratif, jadi
seluruh blok `DO` dilewati. Ini **tidak bisa ditambal** dengan dependensi
tambahan — tetapi juga **tidak masalah**: `--postgres` membaca schema live
yang sudah mencakup semua perubahan dari file-file itu.

Catatan: `20261018_n51_add_missing_foreign_keys.sql` memakai `DO $$`, jadi
`grep "DO \$\$"` di awal sempat memberi 0 karena escaping shell — pakai
`grep -l 'DO \$\$' *.sql` dengan tanda kutip tunggal.

## Kenapa frontend tidak di-graph

Dua renderer monolitik mendominasi biaya parse:

| File | Ukuran |
|:---|:---|
| `mobile/src/App.tsx` | 2.0 MB |
| `desktop/src/App.tsx` | 1.8 MB |

tree-sitter harus mengurai ~3.8 MB TSX di dua file itu. Hasil ukur:

| | build | update inkremental |
|:---|---:|---:|
| backend (2.017 node) | 7s | **2.5s** |
| frontend (1.527 node) | **6m21s** | **6m20s** |

Incremental pada backend memang jalan (`No code-graph topology changes
detected`). Di frontend tidak menolong: file monolit diparse ulang penuh
setiap kali. Nol manfaat sepadan dengan 6 menit per build.

**Kalau butuh graph frontend**, extract per-app, jangan seluruh `frontend/`:

```bash
graphify extract ./frontend/tablet --code-only   # 0.1 MB, cepat
graphify extract ./frontend/mobile --code-only   # 2.0 MB, ~3 menit
```

`.graphifyignore` di `frontend/` sudah disiapkan untuk itu. Isinya
mencegah `dist/` dianggap arsitektur asli — itu alasan utamanya, bukan
percepatan (uji A/B: 6m33s vs 6m22s, selisih noise).

## Akurasi yang sudah diverifikasi

15 klaim baris-spesifik diuji dengan `sed` terhadap file aslinya.
**Semua tepat sampai nomor baris**, termasuk edge `INFERRED`:

| Klaim | Verifikasi |
|:---|:---|
| `AuthRequired` `auth.go:L307` | `func AuthRequired(...)` di L307 |
| dipanggil `main.go:L436` | `middleware.AuthRequired(cfg)` di L436 |
| `IsRedisAvailable` `auth.go:L617` | tepat di L617 |
| `User` struct `user.go:L10` | `type User struct {` di L10 |
| `RegisterSessionFingerprint` `auth.go:L640` | tepat di L640 |
| `.IsPlatformStaff()` L349 (INFERRED 0.85) | benar |

Temuan berguna: `graphify affected MfaPolicyFor` menemukan
`.RefreshToken()` di `auth_handler.go:L2054` — jalur refresh token
memang di-gate MFA. **Grep hanya menemukan 5 baris; graphify 12 pemanggil.**

## Batasan yang perlu diingat

1. **Bukan pengganti grep.** Untuk `grep -rn MfaPolicyFor` (53 kata) vs
   `graphify affected` (70 kata), grep **lebih hemat 32%** untuk pertanyaan
   sempit. Klaim "83x hemat" diukur vs membuang SELURUH corpus (134k token),
   bukan vs grep.
2. **Query natural-language kasar.** `query "alur autentikasi"` mengembalikan
   257 node, dipotong 20, dan memuat noise (`TestNotificationSuperadmin...`
   untuk pertanyaan soal token). Pertanyaan luas = hasil ngawur.
3. **Tanpa API key, komunitas jadi `Community 0..77`.** `GRAPH_REPORT.md`
   kehilangan nilai sebagai peta. Yang tetap berguna: God Nodes,
   Surprising Connections, Import Cycles.
4. **Simbol bernama sama ambigu.** `App()` ada 3 (mobile/desktop/tablet).
   Harus pakai `path::symbol` → `graphify explain "mobile/src/App.tsx::App()"`.
5. Node tabel Postgres hanya dicari lewat id `postgresql_*`, bukan label
   ber-quote (lihat bagian "Schema Postgres ikut ter-graph").

## Kapan pakai apa

| Pertanyaan | Alat |
|:---|:---|
| "X dideklarasikan di mana" | grep |
| "kalau X diubah, apa yang kena" | **graphify affected** |
| "alur A ke B lewat mana" | **graphify path** |
| "jelaskan struktur module X" | **graphify explain** |
| "hub arsitektur / import cycle" | **graphify god-nodes** |

Graphify untuk **peta**, grep untuk **konfirmasi**.
