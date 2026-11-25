-- N-67: Drop duplicate subscription_orders indexes, add proration snapshot column,
-- and enforce partial uniqueness on active pending transfer unique codes.

DO $$
BEGIN
    IF to_regclass('public.subscription_orders') IS NOT NULL
       AND (SELECT relkind FROM pg_class WHERE oid = to_regclass('public.subscription_orders')) = 'r' THEN
        DROP INDEX IF EXISTS idx_sub_orders_payment_status;
        DROP INDEX IF EXISTS idx_sub_orders_unique_code;

        ALTER TABLE subscription_orders
            ADD COLUMN IF NOT EXISTS proration_credit_amount NUMERIC(15,2) NOT NULL DEFAULT 0;

        CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_orders_active_unique_code
            ON subscription_orders (unique_code)
            WHERE payment_status IN ('pending', 'pending_verification')
              AND unique_code > 0;
    END IF;
END $$;
