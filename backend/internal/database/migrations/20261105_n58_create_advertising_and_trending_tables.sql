-- Migrasi N-58: Arsitektur Penempatan Iklan (Sponsored Placements) & Showcase Tren Organik 7 Hari Catavor
--
-- 1. Penambahan Kolom Skor Tren 7 Hari (Rolling 7-Day Velocity):
--    - products.trending_score_7d
--    - stores.trending_score_7d
--
-- 2. Pembuatan Tabel Master Slot Iklan (ad_slots)
--    - Mendefinisikan lokasi fisik penempatan, kuota simultan, dan tarif harian
--
-- 3. Pembuatan Tabel Kampanye Iklan Merchant (ad_campaigns)
--    - Mendukung isolasi penuh: Hanya Profil Toko vs Hanya Item Produk Spesifik
--    - Integritas relasional ganda: target_store_id & target_product_id dengan constraint
--
-- 4. Pembuatan Tabel Faktur & Transaksi Sewa Iklan (ad_orders)
--    - Controlled Denormalization: Snapshot nama slot, tarif, durasi, status pembayaran
--
-- 5. Pembuatan Tabel Agregasi Harian Metrik Iklan (ad_daily_metrics)
--    - Terisolasi dari analitik organik, mencatat impresi, klik detail, klik WhatsApp, biaya
--
-- 6. Inisialisasi Default Master Slot Iklan

-- 1. Kolom Skor Tren 7 Hari pada Tabel Master
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        ALTER TABLE products ADD COLUMN IF NOT EXISTS trending_score_7d BIGINT DEFAULT 0;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stores') THEN
        ALTER TABLE stores ADD COLUMN IF NOT EXISTS trending_score_7d BIGINT DEFAULT 0;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_trending_7d ON products(trending_score_7d DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_stores_trending_7d ON stores(trending_score_7d DESC) WHERE is_blacklisted = false;

-- 2. Master Slot Iklan
CREATE TABLE IF NOT EXISTS ad_slots (
    id BIGSERIAL PRIMARY KEY,
    slot_code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    target_entity VARCHAR(50) NOT NULL DEFAULT 'store', -- 'store' | 'product' | 'mixed'
    allowed_product_types VARCHAR(255) NOT NULL DEFAULT 'all',
    max_items_displayed INT NOT NULL DEFAULT 4,
    pricing_model VARCHAR(50) NOT NULL DEFAULT 'flat_daily', -- 'flat_daily' | 'cpm' | 'cpc'
    default_rate_per_day DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    min_duration_days INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ad_slots_active ON ad_slots(is_active);
CREATE INDEX IF NOT EXISTS idx_ad_slots_entity ON ad_slots(target_entity);

-- 3. Kampanye Iklan Merchant (Dengan Enforced Dual Foreign Keys)
CREATE TABLE IF NOT EXISTS ad_campaigns (
    id BIGSERIAL PRIMARY KEY,
    campaign_code VARCHAR(100) NOT NULL UNIQUE,
    store_id BIGINT NOT NULL,
    ad_slot_id BIGINT NOT NULL,
    target_type VARCHAR(50) NOT NULL DEFAULT 'store', -- 'store' | 'product'
    target_store_id BIGINT DEFAULT NULL,
    target_product_id BIGINT DEFAULT NULL,
    target_id BIGINT NOT NULL,
    campaign_name VARCHAR(255) NOT NULL,
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending_payment',
    -- 'draft' | 'pending_payment' | 'active' | 'paused' | 'completed' | 'cancelled' | 'rejected' | 'in_review'
    pricing_model VARCHAR(50) NOT NULL DEFAULT 'flat_daily',
    budget_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    spent_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    priority_weight INT NOT NULL DEFAULT 10,
    daily_impression_cap INT NOT NULL DEFAULT 0,
    target_product_type VARCHAR(50) NOT NULL DEFAULT 'all',
    target_city VARCHAR(100) DEFAULT NULL,
    custom_badge_text VARCHAR(50) DEFAULT 'Disponsori',
    rejection_reason TEXT DEFAULT NULL,
    approved_by_user_id BIGINT DEFAULT NULL,
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Foreign key & check constraint guards
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ad_campaigns_store') THEN
        ALTER TABLE ad_campaigns ADD CONSTRAINT fk_ad_campaigns_store 
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ad_campaigns_slot') THEN
        ALTER TABLE ad_campaigns ADD CONSTRAINT fk_ad_campaigns_slot 
            FOREIGN KEY (ad_slot_id) REFERENCES ad_slots(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ad_campaigns_target_store') THEN
        ALTER TABLE ad_campaigns ADD CONSTRAINT fk_ad_campaigns_target_store 
            FOREIGN KEY (target_store_id) REFERENCES stores(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ad_campaigns_target_product') THEN
        ALTER TABLE ad_campaigns ADD CONSTRAINT fk_ad_campaigns_target_product 
            FOREIGN KEY (target_product_id) REFERENCES products(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ad_campaigns_dates') THEN
        ALTER TABLE ad_campaigns ADD CONSTRAINT chk_ad_campaigns_dates 
            CHECK (end_at > start_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ad_campaigns_target_integrity') THEN
        ALTER TABLE ad_campaigns ADD CONSTRAINT chk_ad_campaigns_target_integrity 
            CHECK (
                (target_type = 'store' AND target_store_id IS NOT NULL AND target_product_id IS NULL) OR
                (target_type = 'product' AND target_product_id IS NOT NULL)
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_active_rotation 
ON ad_campaigns (ad_slot_id, status, start_at, end_at, priority_weight) 
WHERE deleted_at IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_store ON ad_campaigns(store_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_target_store ON ad_campaigns(target_store_id) WHERE target_store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_target_prod ON ad_campaigns(target_product_id) WHERE target_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_prod_type ON ad_campaigns(target_product_type);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_dates ON ad_campaigns(start_at, end_at);

-- 4. Faktur Pembayaran Sewa Iklan (ad_orders)
CREATE TABLE IF NOT EXISTS ad_orders (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(100) NOT NULL UNIQUE,
    campaign_id BIGINT NOT NULL,
    store_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    slot_name_snapshot VARCHAR(255) NOT NULL,
    pricing_model_snapshot VARCHAR(50) NOT NULL,
    duration_days INT NOT NULL DEFAULT 1,
    original_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    final_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    coupon_code VARCHAR(100) DEFAULT NULL,
    unique_code INT NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- 'pending' | 'pending_verification' | 'paid' | 'rejected' | 'expired' | 'refunded'
    sender_account_name VARCHAR(150) DEFAULT NULL,
    sender_bank_name VARCHAR(100) DEFAULT NULL,
    payment_proof_url TEXT DEFAULT NULL,
    gateway_provider VARCHAR(50) DEFAULT NULL,
    gateway_reference VARCHAR(150) DEFAULT NULL,
    gateway_payment_link TEXT DEFAULT NULL,
    gateway_raw_response JSONB DEFAULT NULL,
    rejection_reason TEXT DEFAULT NULL,
    approved_by_user_id BIGINT DEFAULT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ad_orders_campaign') THEN
        ALTER TABLE ad_orders ADD CONSTRAINT fk_ad_orders_campaign 
            FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ad_orders_store') THEN
        ALTER TABLE ad_orders ADD CONSTRAINT fk_ad_orders_store 
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ad_orders_user') THEN
        ALTER TABLE ad_orders ADD CONSTRAINT fk_ad_orders_user 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ad_orders_campaign ON ad_orders(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_orders_store ON ad_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_ad_orders_status ON ad_orders(payment_status);

-- 5. Agregasi Harian Metrik Iklan (ad_daily_metrics)
CREATE TABLE IF NOT EXISTS ad_daily_metrics (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL,
    ad_slot_id BIGINT NOT NULL,
    store_id BIGINT NOT NULL,
    date VARCHAR(10) NOT NULL, -- YYYY-MM-DD
    impressions_count BIGINT NOT NULL DEFAULT 0,
    clicks_count BIGINT NOT NULL DEFAULT 0,
    wa_clicks_count BIGINT NOT NULL DEFAULT 0,
    cost_incurred DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    ctr_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ad_daily_metrics_camp_date UNIQUE (campaign_id, date)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ad_metrics_campaign') THEN
        ALTER TABLE ad_daily_metrics ADD CONSTRAINT fk_ad_metrics_campaign 
            FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ad_metrics_slot') THEN
        ALTER TABLE ad_daily_metrics ADD CONSTRAINT fk_ad_metrics_slot 
            FOREIGN KEY (ad_slot_id) REFERENCES ad_slots(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ad_metrics_store') THEN
        ALTER TABLE ad_daily_metrics ADD CONSTRAINT fk_ad_metrics_store 
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ad_daily_metrics_store_date ON ad_daily_metrics(store_id, date);
CREATE INDEX IF NOT EXISTS idx_ad_daily_metrics_slot_date ON ad_daily_metrics(ad_slot_id, date);

-- 6. Inisialisasi Master Slot Iklan Default Platform
INSERT INTO ad_slots (slot_code, name, description, target_entity, allowed_product_types, max_items_displayed, pricing_model, default_rate_per_day, min_duration_days, is_active)
VALUES
    ('landing_hero_showcase', 'Slot Utama Beranda (Profil Toko)', 'Penempatan profil katalog toko prioritas tertinggi di bagian atas landing page.', 'store', 'all', 4, 'flat_daily', 25000.00, 1, true),
    ('landing_spotlight_products', 'Flash Spotlight Produk Unggulan', 'Penempatan kartu item produk pilihan lintas sektor di etalase beranda.', 'product', 'all', 6, 'flat_daily', 15000.00, 1, true),
    ('landing_sector_food', 'Etalase Kuliner & Makanan', 'Penempatan produk unggulan bersponsor khusus pada tab kategori Kuliner.', 'product', 'food', 4, 'flat_daily', 10000.00, 1, true),
    ('landing_sector_physical', 'Etalase Barang Fisik & Fashion', 'Penempatan produk unggulan bersponsor khusus pada tab kategori Barang Fisik.', 'product', 'physical', 4, 'flat_daily', 10000.00, 1, true),
    ('landing_sector_fauna', 'Etalase Fauna & Hewan Peliharaan', 'Penempatan produk unggulan bersponsor khusus pada tab kategori Fauna.', 'product', 'fauna', 4, 'flat_daily', 10000.00, 1, true),
    ('landing_sector_plant', 'Etalase Tanaman & Flora', 'Penempatan produk unggulan bersponsor khusus pada tab kategori Tanaman.', 'product', 'plant', 4, 'flat_daily', 10000.00, 1, true),
    ('landing_sector_service', 'Etalase Jasa & Layanan Profesional', 'Penempatan produk unggulan bersponsor khusus pada tab kategori Jasa.', 'product', 'service', 4, 'flat_daily', 10000.00, 1, true),
    ('landing_sector_digital', 'Etalase Produk Digital & Kreatif', 'Penempatan produk unggulan bersponsor khusus pada tab kategori Digital.', 'product', 'digital', 4, 'flat_daily', 10000.00, 1, true),
    ('landing_sector_property', 'Etalase Properti & Sewa Ruang', 'Penempatan produk unggulan bersponsor khusus pada tab kategori Properti.', 'product', 'property', 4, 'flat_daily', 15000.00, 1, true)
ON CONFLICT (slot_code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    target_entity = EXCLUDED.target_entity,
    allowed_product_types = EXCLUDED.allowed_product_types,
    max_items_displayed = EXCLUDED.max_items_displayed,
    pricing_model = EXCLUDED.pricing_model,
    default_rate_per_day = EXCLUDED.default_rate_per_day,
    updated_at = CURRENT_TIMESTAMP;

