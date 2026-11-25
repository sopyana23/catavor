-- N-66: Relational coupons & coupon_redemptions schema with idempotent backfill from settings.master_coupons.
-- Guarded for both fresh empty DB bootstrap (with or without prior ORM AutoMigrate) and existing production DBs.

CREATE TABLE IF NOT EXISTS coupons (
    id                 BIGSERIAL PRIMARY KEY,
    code               VARCHAR(64) NOT NULL UNIQUE,
    label              VARCHAR(255) NOT NULL,
    type               VARCHAR(20) NOT NULL DEFAULT 'discount',
    discount           NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    usage_limit        INT NOT NULL DEFAULT 0 CHECK (usage_limit >= 0),
    used_count         INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    max_uses_per_store INT NOT NULL DEFAULT 1 CHECK (max_uses_per_store >= 0),
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at         TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons (is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_expires_at ON coupons (expires_at);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id          BIGSERIAL PRIMARY KEY,
    coupon_id   BIGINT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    store_id    BIGINT,
    user_id     BIGINT,
    order_id    BIGINT,
    status      VARCHAR(20) NOT NULL DEFAULT 'reserved',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_lookup
    ON coupon_redemptions (coupon_id, store_id, status);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_order_id
    ON coupon_redemptions (order_id);

DO $$
BEGIN
    IF to_regclass('public.stores') IS NOT NULL
       AND (SELECT relkind FROM pg_class WHERE oid = to_regclass('public.stores')) = 'r'
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conname = 'fk_coupon_redemptions_store'
             AND conrelid = 'public.coupon_redemptions'::regclass
       ) THEN
        ALTER TABLE coupon_redemptions
            ADD CONSTRAINT fk_coupon_redemptions_store
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;
    END IF;

    IF to_regclass('public.users') IS NOT NULL
       AND (SELECT relkind FROM pg_class WHERE oid = to_regclass('public.users')) = 'r'
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conname = 'fk_coupon_redemptions_user'
             AND conrelid = 'public.coupon_redemptions'::regclass
       ) THEN
        ALTER TABLE coupon_redemptions
            ADD CONSTRAINT fk_coupon_redemptions_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    IF to_regclass('public.subscription_orders') IS NOT NULL
       AND (SELECT relkind FROM pg_class WHERE oid = to_regclass('public.subscription_orders')) = 'r'
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conname = 'fk_coupon_redemptions_order'
             AND conrelid = 'public.coupon_redemptions'::regclass
       ) THEN
        ALTER TABLE coupon_redemptions
            ADD CONSTRAINT fk_coupon_redemptions_order
            FOREIGN KEY (order_id) REFERENCES subscription_orders(id) ON DELETE SET NULL;
    END IF;

    -- One-time idempotent backfill from settings.master_coupons JSON array when present
    IF to_regclass('public.settings') IS NOT NULL
       AND (SELECT relkind FROM pg_class WHERE oid = to_regclass('public.settings')) = 'r' THEN
        INSERT INTO coupons (
            code, label, type, discount, usage_limit, used_count,
            max_uses_per_store, is_active, expires_at, created_at, updated_at
        )
        SELECT DISTINCT ON (UPPER(TRIM(item->>'code')))
            UPPER(TRIM(item->>'code')),
            COALESCE(NULLIF(TRIM(item->>'label'), ''), 'Kupon ' || UPPER(TRIM(item->>'code'))),
            CASE WHEN LOWER(COALESCE(item->>'type', '')) = 'free' THEN 'free' ELSE 'discount' END,
            GREATEST(0, COALESCE(NULLIF(item->>'discount', '')::NUMERIC, 0)),
            GREATEST(0, COALESCE(NULLIF(item->>'usage_limit', '')::INT, 0)),
            GREATEST(0, COALESCE(NULLIF(item->>'used_count', '')::INT, 0)),
            GREATEST(0, COALESCE(NULLIF(item->>'max_uses_per_store', '')::INT, 1)),
            COALESCE((item->>'is_active')::BOOLEAN, TRUE),
            NULLIF(TRIM(COALESCE(item->>'expires_at', '')), '')::TIMESTAMPTZ,
            COALESCE(NULLIF(TRIM(COALESCE(item->>'created_at', '')), '')::TIMESTAMPTZ, NOW()),
            COALESCE(NULLIF(TRIM(COALESCE(item->>'updated_at', '')), '')::TIMESTAMPTZ, NOW())
        FROM settings s
        CROSS JOIN LATERAL jsonb_array_elements(
            CASE
                WHEN s.value IS NOT NULL
                 AND TRIM(s.value) LIKE '[%'
                 AND jsonb_typeof(s.value::jsonb) = 'array'
                THEN s.value::jsonb
                ELSE '[]'::jsonb
            END
        ) AS item
        WHERE s.key = 'master_coupons'
          AND COALESCE(TRIM(item->>'code'), '') <> ''
        ON CONFLICT (code) DO NOTHING;

        UPDATE settings
           SET value = '[]',
               updated_at = NOW()
         WHERE key = 'master_coupons'
           AND COALESCE(TRIM(value), '') NOT IN ('', '[]');
    END IF;
END $$;
