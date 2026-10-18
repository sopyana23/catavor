-- N-53: Sumber otoritatif tunggal untuk master categories per product type.
--
-- Tabel ini menggantikan hardcoded DefaultMasterCategories di store_handler.go.
-- Data awal ditanam di sini; dapat diperbarui via API tanpa recompile.

CREATE TABLE IF NOT EXISTS master_categories (
    id           SERIAL PRIMARY KEY,
    product_type VARCHAR(50)  NOT NULL,
    name         VARCHAR(100) NOT NULL,
    sort_order   INTEGER      NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT idx_master_cat_type_name UNIQUE (product_type, name)
);

-- Seed data awal (idempoten via ON CONFLICT).
-- Sumber: DefaultMasterCategories di store_handler.go.

INSERT INTO master_categories (product_type, name, sort_order) VALUES
    ('physical', 'Pakaian & Fashion', 1),
    ('physical', 'Aksesoris & Gadget', 2),
    ('physical', 'Elektronik & Komputer', 3),
    ('physical', 'Perlengkapan Rumah', 4),
    ('physical', 'Kerajinan & Kriya', 5),
    ('physical', 'Koleksi & Hobi', 6),
    ('physical', 'Lainnya', 7),
    ('food', 'Makanan Utama (Main Course)', 1),
    ('food', 'Dessert & Manisan', 2),
    ('food', 'Minuman & Olahan Kopi', 3),
    ('food', 'Camilan & Kudapan (Appetizer)', 4),
    ('food', 'Bakery, Roti & Pastry', 5),
    ('food', 'Makanan Beku (Frozen)', 6),
    ('food', 'Paket Hemat & Bundling', 7),
    ('food', 'Lainnya', 8),
    ('service', 'Perawatan & Grooming', 1),
    ('service', 'Servis & Reparasi', 2),
    ('service', 'Desain Grafis & Kreatif', 3),
    ('service', 'Fotografi & Videografi', 4),
    ('service', 'Kursus & Pelatihan', 5),
    ('service', 'Konsultasi & Jasa Ahli', 6),
    ('service', 'Kebersihan & Maintenance', 7),
    ('service', 'Lainnya', 8),
    ('digital', 'E-Book & PDF', 1),
    ('digital', 'Template Dokumen & Notion', 2),
    ('digital', 'Desain Grafis & UI Kit', 3),
    ('digital', 'Source Code & Script', 4),
    ('digital', 'Audio & Musik', 5),
    ('digital', 'Preset & Filter', 6),
    ('digital', 'Video & Aset 3D', 7),
    ('digital', 'Lisensi Software', 8),
    ('digital', 'Lainnya', 9),
    ('fauna', 'Ikan Hias', 1),
    ('fauna', 'Reptil & Amfibi', 2),
    ('fauna', 'Burung & Unggas', 3),
    ('fauna', 'Mamalia Kecil', 4),
    ('fauna', 'Kucing & Anjing', 5),
    ('fauna', 'Invertebrata & Serangga', 6),
    ('fauna', 'Lainnya', 7),
    ('property', 'Rumah Tinggal (Landed House)', 1),
    ('property', 'Apartemen & Kondominium', 2),
    ('property', 'Tanah & Kavling', 3),
    ('property', 'Ruko & Komersial', 4),
    ('property', 'Villa & Resort', 5),
    ('property', 'Gudang & Pabrik', 6),
    ('property', 'Kost & Kontrakan', 7),
    ('property', 'Lainnya', 8),
    ('plant', 'Tanaman Hias Daun', 1),
    ('plant', 'Tanaman Bunga & Anggrek', 2),
    ('plant', 'Bibit Buah & Pohon', 3),
    ('plant', 'Kaktus & Sukulen', 4),
    ('plant', 'Bonsai & Tanaman Seni', 5),
    ('plant', 'Tanaman Herbal & Rempah', 6),
    ('plant', 'Aquascape & Tanaman Air', 7),
    ('plant', 'Lainnya', 8)
ON CONFLICT (product_type, name) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();
