-- N-52: hapus tabel faunas yang sudah tidak dipakai.
--
-- Semua operasi produk (termasuk tipe 'fauna') kini melalui tabel 'products'.
-- Tabel 'faunas' adalah warisan dari iterasi awal DFauna; tidak ada handler,
-- route, atau model yang masih merujuknya. Data: 0 baris. FK references: 0.
--
-- Idempoten: DROP TABLE IF EXISTS.

DROP TABLE IF EXISTS faunas;
