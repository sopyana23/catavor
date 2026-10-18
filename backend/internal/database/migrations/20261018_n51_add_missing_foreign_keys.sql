-- N-51: pasang foreign key pada kolom relasi yang selama ini tidak dijaga.
--
-- Kolom-kolom ini menyimpan referensi (user_id, store_id) tetapi tanpa
-- constraint apa pun, sehingga baris yatim bisa masuk dan tidak pernah
-- terdeteksi. Data yatim saat migrasi ini ditulis: 0 baris.
--
-- Aturan ON DELETE mengikuti semantik tiap tabel dan deklarasi di model Go:
--   user_sessions.user_id            CASCADE   sesi tidak berguna tanpa user
--   notification_reads.user_id       CASCADE   status baca milik user itu
--   notification_reads.store_id      CASCADE   status baca milik toko itu
--   user_policy_agreements.user_id   SET NULL  catatan persetujuan tetap
--   user_policy_agreements.store_id  SET NULL  catatan persetujuan tetap
--   articles.store_id                SET NULL  artikel jadi artikel platform
--
-- Idempoten: constraint dibuat hanya bila belum ada. Bila sudah ada dengan
-- aturan salah, constraint dibuang lebih dulu lalu dibuat ulang.

DO $$
DECLARE
    spec RECORD;
BEGIN
    FOR spec IN
        SELECT * FROM (VALUES
            ('user_sessions',  'user_id',     'users',  'CASCADE'),
            ('notification_reads', 'user_id', 'users',  'CASCADE'),
            ('notification_reads', 'store_id','stores', 'CASCADE'),
            ('user_policy_agreements', 'user_id',  'users',  'SET NULL'),
            ('user_policy_agreements', 'store_id', 'stores', 'SET NULL'),
            ('articles',       'store_id',    'stores', 'SET NULL')
        ) AS t(tbl, col, ref_tbl, on_delete)
    LOOP
        -- Lewati bila tabel atau kolomnya tidak ada (instalasi berbeda versi).
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = spec.tbl AND column_name = spec.col
        ) THEN
            RAISE NOTICE 'lewat: kolom %.% tidak ada', spec.tbl, spec.col;
            CONTINUE;
        END IF;

        -- SET NULL mustahil pada kolom NOT NULL. Untuk kolom nullable secara
        -- semantik (artikel platform tidak dimiliki toko), longgarkan dulu.
        IF spec.on_delete = 'SET NULL' THEN
            EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL', spec.tbl, spec.col);
        END IF;

        -- Buang constraint yang sudah ada pada kolom ini, apa pun namanya.
        -- Termasuk yang aturannya salah, agar bisa dibuat ulang dengan benar.
        DECLARE
            cname TEXT;
        BEGIN
            FOR cname IN
                SELECT con.conname
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                JOIN pg_attribute att ON att.attrelid = con.conrelid
                WHERE con.contype = 'f'
                  AND rel.relname = spec.tbl
                  AND att.attname = spec.col
                  AND att.attnum = ANY (con.conkey)
            LOOP
                EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', spec.tbl, cname);
            END LOOP;
        END;

        EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(id) ON DELETE %s',
            spec.tbl,
            'fk_n51_' || spec.tbl || '_' || spec.col,
            spec.col,
            spec.ref_tbl,
            spec.on_delete
        );

        RAISE NOTICE 'fk terpasang: %.% -> % (ON DELETE %)', spec.tbl, spec.col, spec.ref_tbl, spec.on_delete;
    END LOOP;
END $$;
