-- =====================================================================
-- N-45: Deduplikasi foreign key (schema hygiene)
-- =====================================================================
-- MASALAH
--   Empat kolom memiliki DUA foreign key ke tabel yang sama. Penyebabnya
--   campuran riwayat AutoMigrate + SQL manual (mis. rename faunas -> products)
--   yang tidak pernah dibersihkan. Dampak nyata:
--     * biaya perawatan ganda pada setiap INSERT/UPDATE/DELETE,
--     * pg_dump / restore & migrasi skema jadi rawan konflik nama,
--     * untuk support_tickets.rated_agent_id salah satu constraint TIDAK
--       punya ON DELETE SET NULL, sehingga satu-satunya aturan yang berlaku
--       bisa memblokir penghapusan user yang pernah menilai tiket.
--
-- TINDAKAN
--   Simpan SATU constraint per kolom, dengan aturan ON DELETE paling tepat
--   untuk domainnya. Idempoten: aman dijalankan berulang.
--
-- CATATAN PENTING
--   Constraint di sini tidak dideklarasikan di model Go (dibuat AutoMigrate
--   sebagai FK default), sehingga AutoMigrate TIDAK akan membuatnya kembali
--   setelah dibuang.
--
-- RIWAYAT BERKAS (N-45 -> N-45b)
--   Berkas ini sebelumnya bernama 20261018_n45_dedupe_foreign_keys.sql dan
--   TIDAK dijaga. Pada instalasi baru (AutoMigrate tidak lagi membuat tabel
--   `sightings`) berkas itu gagal dan server tidak pernah boot. Karena berkas
--   yang sudah diterapkan tidak boleh diubah isinya (checksum dijaga), berkas
--   diganti nama menjadi N-45b. Database lama yang sudah mencatat N-45 akan
--   menjalankan N-45b sekali lagi — aman, karena seluruh pernyataannya
--   idempoten (DROP ... IF EXISTS + ADD ulang).
-- =====================================================================

BEGIN;

-- 1. stores.user_id -> users(id)
--    Simpan varian ON DELETE CASCADE: profil toko tidak boleh hidup tanpa
--    pemiliknya (dan menghindari user yatim).
ALTER TABLE stores DROP CONSTRAINT IF EXISTS fk_users_store;
-- Pastikan definisinya BENAR. Constraint yang sudah ada tanpa aturan
-- ON DELETE juga harus diperbaiki, bukan hanya dilewati.
ALTER TABLE stores DROP CONSTRAINT IF EXISTS fk_users_stores;
ALTER TABLE stores
    ADD CONSTRAINT fk_users_stores
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 2. products.store_id -> stores(id)
--    Simpan varian ON DELETE CASCADE agar produk ikut terhapus bersama toko.
ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_stores_faunas;
-- Pastikan definisinya BENAR. Constraint yang sudah ada tanpa aturan
-- ON DELETE juga harus diperbaiki, bukan hanya dilewati.
ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_stores_products;
ALTER TABLE products
    ADD CONSTRAINT fk_stores_products
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

-- 3. sightings.fauna_id -> products(id)
--    Simpan varian ON DELETE CASCADE: laporan perjumpaan mengikuti itemnya.
--
--    PENTING: tabel `sightings` adalah warisan dan TIDAK dibuat AutoMigrate
--    lagi (model-nya sudah dihapus). Pada instalasi BARU tabel itu tidak
--    pernah ada, sehingga ALTER TABLE langsung gagal dan seluruh boot
--    server berhenti. Karena itu blok ini dijaga: hanya dijalankan bila
--    tabelnya benar-benar ada (instalasi lama).
DO $$
BEGIN
    IF to_regclass('public.sightings') IS NULL THEN
        RAISE NOTICE 'n45b: tabel sightings tidak ada, blok 3 dilewati';
        RETURN;
    END IF;

    ALTER TABLE sightings DROP CONSTRAINT IF EXISTS fk_faunas_sightings;
    ALTER TABLE sightings DROP CONSTRAINT IF EXISTS fk_products_sightings;
    ALTER TABLE sightings
        ADD CONSTRAINT fk_products_sightings
        FOREIGN KEY (fauna_id) REFERENCES products(id) ON DELETE CASCADE;
END
$$;

-- 4. support_tickets.rated_agent_id -> users(id)
--    Simpan varian ON DELETE SET NULL (penilai tiket adalah metadata CSAT;
--    tiket tidak boleh hilang karena agennya dihapus).
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS fk_support_tickets_rated_agent;
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_rated_agent_id_fkey;
ALTER TABLE support_tickets
    ADD CONSTRAINT support_tickets_rated_agent_id_fkey
    FOREIGN KEY (rated_agent_id) REFERENCES users(id) ON DELETE SET NULL;

COMMIT;
