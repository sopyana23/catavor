-- Migrasi N-57: Peningkatan Arsitektur Subsistem Pembayaran Tri-Mode Catavor
--
-- 1. Penyesuaian Tabel subscription_orders
--    - Perbaikan default payment_status dari 'paid' (dummy) menjadi 'pending'
--    - Penambahan kolom payment_mode, unique_code (3-digit), sender_account_name, sender_phone
--    - Penambahan kolom gateway_provider, gateway_reference, gateway_payment_link, gateway_raw_response
--    - Penambahan kolom rejection_reason, approved_by_user_id, expires_at (TTL 2 jam)
--
-- 2. Penambahan Indeks Kinerja
--    - idx_sub_orders_payment_status, idx_sub_orders_gateway_ref, idx_sub_orders_expires_at, idx_sub_orders_unique_code
--
-- 3. Inisialisasi Kunci Pengaturan Default Sistem Pembayaran (settings)
--    - payment_system_mode, payment_maintenance_title, payment_maintenance_message, payment_qris_manual_image, dll.

-- 1. Tabel subscription_orders: Perbaikan default dan penambahan kolom
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_orders') THEN
        -- Perbaiki default payment_status menjadi pending
        ALTER TABLE subscription_orders ALTER COLUMN payment_status SET DEFAULT 'pending';

        -- Tambah kolom-kolom baru secara idempoten
        ALTER TABLE subscription_orders ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'manual_qris';
        ALTER TABLE subscription_orders ADD COLUMN IF NOT EXISTS unique_code INT DEFAULT 0;
        ALTER TABLE subscription_orders ADD COLUMN IF NOT EXISTS sender_account_name VARCHAR(150);
        ALTER TABLE subscription_orders ADD COLUMN IF NOT EXISTS sender_phone VARCHAR(50);
        ALTER TABLE subscription_orders ADD COLUMN IF NOT EXISTS gateway_provider VARCHAR(50);
        ALTER TABLE subscription_orders ADD COLUMN IF NOT EXISTS gateway_reference VARCHAR(150);
        ALTER TABLE subscription_orders ADD COLUMN IF NOT EXISTS gateway_payment_link TEXT;
        ALTER TABLE subscription_orders ADD COLUMN IF NOT EXISTS gateway_raw_response JSONB;
        ALTER TABLE subscription_orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
        ALTER TABLE subscription_orders ADD COLUMN IF NOT EXISTS approved_by_user_id BIGINT;
        ALTER TABLE subscription_orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 2. Indeks performa untuk kueri status & worker TTL
CREATE INDEX IF NOT EXISTS idx_sub_orders_payment_status ON subscription_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_sub_orders_gateway_ref ON subscription_orders(gateway_reference);
CREATE INDEX IF NOT EXISTS idx_sub_orders_expires_at ON subscription_orders(expires_at);
CREATE INDEX IF NOT EXISTS idx_sub_orders_unique_code ON subscription_orders(unique_code);

-- 3. Inisialisasi Pengaturan Default Sistem Pembayaran
INSERT INTO settings (key, value, created_at, updated_at) VALUES 
    ('payment_system_mode', 'gateway_aulaa', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('payment_maintenance_title', 'Sistem Pembayaran Dalam Pemeliharaan', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('payment_maintenance_message', 'Layanan transaksi pembayaran sedang dalam pemeliharaan berkala untuk peningkatan keandalan jaringan. Silakan hubungi admin atau coba beberapa saat lagi.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('payment_qris_manual_image', '/img/qris_demo.svg', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('payment_qris_manual_merchant', 'Catavor Official Store', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('payment_bank_name', 'Bank Central Asia (BCA)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('payment_bank_account', '8830-1928-3920', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('payment_bank_holder', 'PT Catavor Media Digital', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

