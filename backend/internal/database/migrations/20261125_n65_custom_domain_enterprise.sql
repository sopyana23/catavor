-- N-65: Enterprise Custom Domain verification, normalization, and unique integrity constraints.
-- Idempotent for both fresh bootstrap and existing production PostgreSQL databases.

DO $$
BEGIN
    IF to_regclass('public.stores') IS NOT NULL THEN
        ALTER TABLE stores ADD COLUMN IF NOT EXISTS custom_domain_verification_token VARCHAR(128) DEFAULT '';
        ALTER TABLE stores ADD COLUMN IF NOT EXISTS custom_domain_verified_at TIMESTAMPTZ;
        ALTER TABLE stores ADD COLUMN IF NOT EXISTS custom_domain_last_checked_at TIMESTAMPTZ;
        ALTER TABLE stores ADD COLUMN IF NOT EXISTS custom_domain_error TEXT DEFAULT '';

        -- Normalize legacy custom_domain strings (lowercase + trimmed; empty string -> NULL)
        UPDATE stores
           SET custom_domain = CASE
               WHEN custom_domain IS NULL OR TRIM(custom_domain) = '' THEN NULL
               ELSE LOWER(TRIM(custom_domain))
           END;

        -- Fix registration/legacy anomaly where custom_domain_status != 'none' without a domain
        UPDATE stores
           SET custom_domain_status = 'none'
         WHERE custom_domain IS NULL
           AND COALESCE(custom_domain_status, '') <> 'none';

        -- Clamp unknown legacy custom_domain_status values to valid state machine entries
        UPDATE stores
           SET custom_domain_status = CASE
               WHEN custom_domain IS NULL THEN 'none'
               ELSE 'pending'
           END
         WHERE custom_domain_status IS NULL
            OR custom_domain_status NOT IN ('none', 'pending', 'verifying', 'active', 'failed', 'inactive_expired');

        DROP INDEX IF EXISTS idx_stores_custom_domain;
        CREATE UNIQUE INDEX IF NOT EXISTS uq_stores_custom_domain_lower
            ON stores (LOWER(custom_domain))
            WHERE custom_domain IS NOT NULL AND custom_domain <> '';

        IF NOT EXISTS (
            SELECT 1
              FROM pg_constraint
             WHERE conname = 'chk_stores_custom_domain_status'
               AND conrelid = 'public.stores'::regclass
        ) THEN
            ALTER TABLE stores
                ADD CONSTRAINT chk_stores_custom_domain_status
                CHECK (custom_domain_status IN ('none', 'pending', 'verifying', 'active', 'failed', 'inactive_expired'));
        END IF;
    END IF;
END $$;
