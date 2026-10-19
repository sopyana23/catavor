-- N-52b: hapus tabel warisan `faunas` bila masih berbentuk tabel.
--
-- Semua operasi produk (termasuk tipe 'fauna') kini melalui tabel 'products'.
-- Tabel 'faunas' adalah warisan dari iterasi awal DFauna; tidak ada handler,
-- route, atau model yang masih merujuknya.
--
-- MENGAPA BERKAS INI DIGANTI NAMA DARI N-52
--   N-52 memakai `DROP TABLE IF EXISTS faunas;`. Itu GAGAL pada instalasi
--   baru dengan SQLSTATE 42809 ("faunas is not a table"): `db.go` sengaja
--   membuat VIEW kompatibilitas `faunas` -> `products` pada setiap boot,
--   sehingga objek bernama `faunas` ada tetapi bukan tabel. `IF EXISTS`
--   hanya menahan objek yang tidak ada, bukan objek dengan tipe berbeda.
--   Berkas yang sudah diterapkan tidak boleh diubah isinya (checksum dijaga),
--   jadi perbaikannya diterbitkan sebagai N-52b.
--
-- PERILAKU
--   * `faunas` berupa tabel  -> dihapus (tujuan asli migrasi).
--   * `faunas` berupa view   -> dilewati; itu shim kompatibilitas yang
--                               memang dikelola `db.go`, bukan warisan.
--   * tidak ada objek        -> tidak melakukan apa pun.
--   Idempoten: aman dijalankan berulang.

DO $$
DECLARE
    objek "char";
BEGIN
    SELECT c.relkind INTO objek
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'faunas';

    IF objek IS NULL THEN
        RAISE NOTICE 'n52b: objek faunas tidak ada, dilewati';
    ELSIF objek = 'r' THEN
        DROP TABLE faunas;
        RAISE NOTICE 'n52b: tabel warisan faunas dihapus';
    ELSIF objek = 'v' THEN
        RAISE NOTICE 'n52b: faunas adalah view kompatibilitas (db.go), dilewati';
    ELSE
        RAISE NOTICE 'n52b: faunas bertipe % , dilewati', objek;
    END IF;
END
$$;
