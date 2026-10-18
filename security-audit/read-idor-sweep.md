# Read-IDOR Sweep — Putaran 6

**Tanggal:** 2026-10-18
**Cakupan:** 42 fungsi handler yang menerima parameter `:id`
**Metode:** pembacaan source + uji runtime lintas-tenant dengan data nyata

## Ringkasan

**Tidak ditemukan IDOR baru.** Seluruh titik yang diperiksa memiliki kontrol
otorisasi yang memadai — baik berupa scope `user_id`/`store_id` di query,
maupun middleware permission di level route.

## Titik yang diperiksa menurut pola kontrol

### 1. Scoped `store_id` (16 fungsi) — aman

`category`, `product`, `fauna` (kecuali `Show`), `notification`, `report`,
`support` (reply/status/attachment), `store.DeleteStore`.

Query selalu menyertakan `store_id` yang berasal dari konteks sesi, bukan dari
input pengguna.

Catatan khusus `ProductHandler.Show` (`/api/fauna/:id`): memakai
`ExtractOptionalClaims` dan menolak produk nonaktif untuk pengunjung anonim.
Relasi `Store` dipangkas lewat `ToPublicView()` (perbaikan N-08) sehingga
`user_id`, `is_blacklisted`, `suspension_reason`, `plan`, `storage_used_bytes`,
dan `dormancy_status` tidak terkirim ke publik.

### 2. Scoped `user_id` (fungsi non-staf) — aman

`SupportHandler.GetTicketDetails`: non-staf hanya bisa membaca tiket dengan
`user_id = miliknya`; staf platform boleh lintas toko.

`SessionHandler.RevokeSession`: `WHERE id = ? AND user_id = ?`.

### 3. Dijaga middleware permission — aman

| Handler | Guard |
|---|---|
| `GetAdminTicketDetails` | `adminApi` + `support:tickets:read` |
| `SafeDomainHandler.Update/Delete` | `adminApi` + `system:settings:manage` |
| `RBACHandler.RevokeStaff` | `adminApi` + `system:admins:manage` |
| `NotificationHandler.Superadmin*` | `adminApi` + `RequireAdmin` |
| `ArticleHandler.Approve/DeleteComment` | `adminApi` + `content:articles:manage` |
| `SupportHandler.Update/DeleteCannedResponse` | `adminApi` + `support:tickets:reply` |

Semua route di `adminApi` berada di belakang `AuthRequired` + `RequireAdmin`,
sehingga operator toko tidak dapat mengaksesnya.

### 4. Platform-wide by design — bukan IDOR

- `SupportCannedResponse`: model **tidak memiliki** `store_id`, template balasan
  bersifat global untuk seluruh staf dukungan.
- `SafeDomain`: daftar domain aman bersifat platform, bukan per-toko.
- `Notification` (siaran): tidak memiliki `user_id`; status baca dilacak di
  tabel terpisah `notification_reads`.

### 5. Dead code

`FaunaHandler.Show` tidak terdaftar pada route mana pun — `/api/fauna/:id`
dilayani `ProductHandler.Show`. Tidak menjadi permukaan serangan.

## Bukti runtime

Data uji: dua user non-staf (`tenant-a`, `tenant-b`) di dua toko berbeda,
satu produk dan satu tiket milik tenant B.

### Uji lintas-tenant (sebagai tenant A)

| Uji | Hasil |
|---|---|
| `GET /api/support/tickets/{id-B}` | **404** |
| `GET /api/admin/support/tickets/{id-B}` | **403** |
| `GET /api/admin/stores/{id-B}` | **403** |
| `GET /api/support/tickets/{id-B}/presence` | **404** |
| `GET /api/admin/safe-domains` | **403** |
| Kontrol positif: tiket milik sendiri | **200** |

**7 PASS / 0 FAIL.**

### Enumerasi ID berurutan (sebagai tenant A)

Tiket ID 1–8: **semua 404** — tidak ada satu pun yang terbaca.

Produk ID 1–6: ID 1 → 200 (produk aktif, publik), 2–6 → 404.
Pemeriksaan field `store` pada response: **tidak ada** `user_id`,
`is_blacklisted`, `suspension_reason`, `storage_used_bytes`, `plan`, atau
`dormancy_status` yang bocor.

## Setelah pengujian

Seluruh data uji dihapus dan kondisi DB dipulihkan:

- `users` = 1 (`owner@catavor.local`)
- `stores` = 0, `products` = 0, `support_tickets` = 0

## Catatan minor (bukan kerentanan)

`SupportHandler.GetPresence` mengembalikan daftar nama admin yang sedang
membuka tiket tertentu kepada pengguna yang tidak berhak. Dampaknya hanya
keterangan "siapa yang sedang online" — tidak sensitif, dan tidak membuka akses
ke data. Tidak ditindaklanjuti.
