-- Migrasi N-56: Peningkatan Struktur Database untuk Online Shop & Catalog Discovery
--
-- 1. Penambahan Kolom Metrik & Spesialisasi Profil Toko (stores)
--    - view_count: Lifetime views profil toko
--    - total_actions_count: Lifetime interaksi/order CTA
--    - primary_product_type: Tipe katalog dominan (physical, food, digital, service, plant, fauna, property, general)
--    - is_featured: Flag kurasi toko unggulan platform
--
-- 2. Penambahan Kolom & Indeks Popularitas Produk (products)
--    - popularity_score: Skor komposit views + (wa_clicks * 3) + (rekber_clicks * 5)
--    - Indeks komposit perankingan (is_active, product_type, view_count DESC, popularity_score DESC)
--
-- 3. Indeks Komposit untuk Kueri Tren Populer Terkini (product_daily_analytics)
--    - Mempercepat agregasi produk populer 7-30 hari terakhir per tipe katalog

-- 1. Tabel stores: Tambah kolom metrik & spesialisasi
ALTER TABLE stores ADD COLUMN IF NOT EXISTS view_count BIGINT DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS total_actions_count BIGINT DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS primary_product_type VARCHAR(50) DEFAULT 'general';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_stores_popularity ON stores(dormancy_status, is_blacklisted, is_suspended, view_count DESC);
CREATE INDEX IF NOT EXISTS idx_stores_primary_type ON stores(primary_product_type);
CREATE INDEX IF NOT EXISTS idx_stores_is_featured ON stores(is_featured);

-- Backfill initial view_count & total_actions_count from daily analytics if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'store_daily_analytics') THEN
        UPDATE stores s
        SET view_count = COALESCE((SELECT SUM(store_views) FROM store_daily_analytics sda WHERE sda.store_id = s.id), 0),
            total_actions_count = COALESCE((SELECT SUM(total_actions) FROM store_daily_analytics sda WHERE sda.store_id = s.id), 0)
        WHERE s.view_count = 0 AND EXISTS (SELECT 1 FROM store_daily_analytics sda WHERE sda.store_id = s.id);
    END IF;
END $$;

-- Backfill primary_product_type from active products
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        UPDATE stores s
        SET primary_product_type = COALESCE((
            SELECT p.product_type 
            FROM products p 
            WHERE p.store_id = s.id AND p.is_active = true 
            GROUP BY p.product_type 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        ), 'general')
        WHERE s.primary_product_type IS NULL OR s.primary_product_type = 'general';
    END IF;
END $$;

-- 2. Tabel products: Tambah skor popularitas komposit & indeks perankingan
ALTER TABLE products ADD COLUMN IF NOT EXISTS popularity_score BIGINT DEFAULT 0;

UPDATE products
SET popularity_score = (COALESCE(view_count, 0) + (COALESCE(wa_clicks_count, 0) * 3) + (COALESCE(rekber_clicks_count, 0) * 5))
WHERE popularity_score = 0 AND (view_count > 0 OR wa_clicks_count > 0 OR rekber_clicks_count > 0);

CREATE INDEX IF NOT EXISTS idx_products_active_views ON products(is_active, view_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_active_popularity ON products(is_active, popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_products_active_type_views ON products(is_active, product_type, view_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_active_type_popularity ON products(is_active, product_type, popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_products_active_wa_clicks ON products(is_active, wa_clicks_count DESC);

-- 3. Tabel product_daily_analytics: Indeks untuk query tren terkini (7 - 30 hari)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_daily_analytics') THEN
        CREATE INDEX IF NOT EXISTS idx_prod_analytics_date_type_views ON product_daily_analytics(date, product_type, views DESC);
        CREATE INDEX IF NOT EXISTS idx_prod_analytics_date_views ON product_daily_analytics(date, views DESC);
        CREATE INDEX IF NOT EXISTS idx_prod_analytics_date_actions ON product_daily_analytics(date, total_actions DESC);
    END IF;
END $$;

