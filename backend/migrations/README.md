# Migrasi SQL manual

Folder ini menampung migrasi **idempoten** untuk environment yang menjalankan
`DB_AUTO_MIGRATE=false` (AutoMigrate GORM dimatikan). Pada mode itu, model baru
di `internal/models` **tidak** otomatis membuat tabel, sehingga endpoint yang
menyentuh tabel tersebut gagal saat runtime.

## Cara menjalankan

```bash
psql -h 127.0.0.1 -p 5432 -U postgres -d catavor -v ON_ERROR_STOP=1 \
  -f backend/migrations/<file>.sql
```

Semua file harus aman dijalankan berulang (`IF NOT EXISTS`), karena tidak ada
tabel pelacak versi.

## Daftar

| File | Tujuan |
|------|--------|
| `20261018_n26_store_daily_traffic_sources.sql` | Membuat `store_daily_traffic_sources` (N-26). Tanpanya `DELETE /api/stores/:id/delete` selalu 500. |

## Catatan N-26

`product_variants` dan `product_images` **tidak** memiliki kolom `store_id` —
relasinya lewat `product_id`. Setiap kode yang ingin membersihkan data per toko
harus memakai sub-query `product_id IN (SELECT id FROM products WHERE store_id = ?)`,
bukan `WHERE store_id = ?`.
