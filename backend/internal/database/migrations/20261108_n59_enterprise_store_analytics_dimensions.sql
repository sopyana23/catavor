-- Migrasi N-59: Enterprise Store Analytics Dimensions, Audience Intelligence & Real-Time Visitor Engine
--
-- 1. Penambahan Kolom Metrik Keterlibatan pada store_daily_analytics:
--    - unique_visitors (Pengunjung unik harian dengan HMAC-SHA256 Daily Rotating Salt)
--    - product_views (Total pembukaan detail item produk harian)
--    - bounces (Kunjungan yang selesai tanpa interaksi lebih lanjut)
--
-- 2. Penambahan Kolom Metrik Keterlibatan pada store_daily_traffic_sources:
--    - unique_visitors
--
-- 3. Pembuatan Tabel Dimensi Audien & Jam Sibuk (store_daily_audience_metrics):
--    - Single-table high-performance dimensional rollup: device, os, browser, city, country, hour, campaign
--    - Mendukung store_id = 0 untuk agregasi global platform
--
-- 4. Pembuatan Tabel Log Kunjungan Real-Time Terbatas (recent_visitor_events):
--    - Menampung aktivitas riil teranonimkan (Zero-PII) untuk live visitor feed

-- 1. Penambahan Kolom pada store_daily_analytics
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'store_daily_analytics') THEN
        ALTER TABLE store_daily_analytics ADD COLUMN IF NOT EXISTS unique_visitors INT DEFAULT 0;
        ALTER TABLE store_daily_analytics ADD COLUMN IF NOT EXISTS product_views INT DEFAULT 0;
        ALTER TABLE store_daily_analytics ADD COLUMN IF NOT EXISTS bounces INT DEFAULT 0;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'store_daily_traffic_sources') THEN
        ALTER TABLE store_daily_traffic_sources ADD COLUMN IF NOT EXISTS unique_visitors INT DEFAULT 0;
    END IF;
END $$;

-- 2. Tabel Agregasi Dimensi Audien Harian
CREATE TABLE IF NOT EXISTS store_daily_audience_metrics (
    id BIGSERIAL PRIMARY KEY,
    store_id BIGINT NOT NULL DEFAULT 0,
    date VARCHAR(10) NOT NULL,
    dimension_type VARCHAR(32) NOT NULL, -- 'device', 'os', 'browser', 'city', 'country', 'hour', 'campaign'
    dimension_value VARCHAR(100) NOT NULL, -- e.g. 'mobile', 'Android', 'Instagram In-App', 'Jakarta', '14', 'promo_lebaran'
    views INT NOT NULL DEFAULT 0,
    unique_visitors INT NOT NULL DEFAULT 0,
    total_actions INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_audience_dim_unique 
    ON store_daily_audience_metrics (store_id, date, dimension_type, dimension_value);

CREATE INDEX IF NOT EXISTS idx_store_audience_lookup 
    ON store_daily_audience_metrics (store_id, dimension_type, date);

-- 3. Tabel Log Kunjungan Real-Time Terbatas (Pruned otomatis, Zero-PII)
CREATE TABLE IF NOT EXISTS recent_visitor_events (
    id BIGSERIAL PRIMARY KEY,
    store_id BIGINT NOT NULL DEFAULT 0,
    store_slug VARCHAR(100) NOT NULL DEFAULT '',
    event VARCHAR(50) NOT NULL DEFAULT 'store_view',
    product_id BIGINT NOT NULL DEFAULT 0,
    product_name VARCHAR(255) NOT NULL DEFAULT '',
    source VARCHAR(50) NOT NULL DEFAULT 'direct',
    device_type VARCHAR(50) NOT NULL DEFAULT 'mobile',
    browser VARCHAR(100) NOT NULL DEFAULT '',
    os VARCHAR(100) NOT NULL DEFAULT '',
    city VARCHAR(100) NOT NULL DEFAULT 'Indonesia',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recent_visitors_store ON recent_visitor_events (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recent_visitors_global ON recent_visitor_events (created_at DESC);

