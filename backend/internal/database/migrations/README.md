# Migrasi SQL manual

Folder ini menampung migrasi **idempoten** yang di-`go:embed` ke binary dan
dijalankan otomatis oleh `RunMigrations` (`internal/database/migrator.go`) pada
setiap boot server — termasuk saat `DB_AUTO_MIGRATE=false` / `SKIP_DB_MIGRATE=true`.

## Cara kerja

- Versi migrasi = nama file. Sudah diterapkannya dicatat di tabel
  `schema_migrations` (`version`, `checksum`, `applied_at`).
- **Checksum dijaga.** Isi file yang sudah tercatat TIDAK boleh diubah; kalau
  berubah, server menolak boot dengan error *checksum drift*.
- Instalasi baru menjalankan **semua** file berurutan. Database lama (skema
  sudah ada sebelum pelacakan versi) di-*baseline*: file yang sudah tercatat
  dilewati.

## Aturan wajib

1. **Idempoten.** `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
   `DROP ... IF EXISTS`. Migrasi bisa dijalankan ulang kapan saja.
2. **Jangan mengandalkan tabel yang tidak dibuat AutoMigrate.** Instalasi baru
   hanya punya tabel dari `internal/database/db.go`. Kalau migrasi menyentuh
   tabel warisan, bungkus dengan pemeriksaan keberadaan objek.
3. **Jangan `DROP TABLE IF EXISTS` untuk objek yang mungkin berupa VIEW.**
   `IF EXISTS` hanya menahan objek yang tidak ada — bukan objek dengan tipe
   berbeda. `db.go` sengaja membuat VIEW kompatibilitas `faunas`, sehingga
   `DROP TABLE IF EXISTS faunas` gagal dengan `SQLSTATE 42809`. Periksa
   `pg_class.relkind` lebih dulu (lihat N-52b).
4. **File yang sudah diterapkan tidak boleh diubah isinya.** Kalau sebuah
   migrasi ternyata bug, terbitkan file baru dengan sufiks huruf
   (`n45` → `n45b`) berisi versi yang diperbaiki. Versi lama akan tercatat
   sebagai *yatim*; migrator mencatatnya sebagai `WRN` dan itu normal.
   File baru aman dijalankan di DB lama karena semua pernyataannya idempoten.

## Verifikasi instalasi baru (wajib sebelum rilis)

Bug kelas paling berbahaya di sini adalah "migrasi hanya jalan di DB yang sudah
ada". Uji dengan database kosong:

```bash
createdb -h 127.0.0.1 -U postgres catavor_fresh
APP_ENV=local DB_NAME=catavor_fresh DB_AUTO_MIGRATE=true SKIP_DB_MIGRATE=false \
  go run ./cmd/server   # harus boot, /healthz = 200
```

CI melakukan ini setiap push lewat job `e2e` (Postgres kosong → boot → seed →
Playwright), jadi kegagalan jenis ini tertangkap otomatis.

## Daftar

| File | Tujuan |
|------|--------|
| `20261018_n26_store_daily_traffic_sources.sql` | Membuat `store_daily_traffic_sources` (N-26). Tanpanya `DELETE /api/stores/:id/delete` selalu 500. |
| `20261018_n45b_dedupe_foreign_keys_guarded.sql` | Dedupe FK warisan; blok `sightings` dijaga `to_regclass` (dulu `n45`, gagal di instalasi baru). |
| `20261018_n51_add_missing_foreign_keys.sql` | Menambah FK yang hilang pada skema lama. |
| `20261018_n52b_drop_faunas_table_guarded.sql` | Menghapus tabel warisan `faunas` **hanya jika** objeknya benar-benar tabel (dulu `n52`, gagal karena `faunas` berupa VIEW). |
| `20261018_n53_master_categories.sql` | Seed `master_categories`. |
| `20261018_n55_master_presets.sql` | Seed preset master. |

## Catatan N-26

`product_variants` dan `product_images` **tidak** memiliki kolom `store_id` —
relasinya lewat `product_id`. Setiap kode yang ingin membersihkan data per toko
harus memakai sub-query `product_id IN (SELECT id FROM products WHERE store_id = ?)`,
bukan `WHERE store_id = ?`.
