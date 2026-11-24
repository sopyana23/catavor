-- N-64: Enterprise hardening & normalisasi fitur Siaran Broadcast
-- Idempoten untuk upgrade DB produksi maupun bootstrap/test skema minimal PostgreSQL.

-- 1. Pastikan tabel notifications & notification_reads ada jika migrasi dijalankan di skema minimal
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    target_type VARCHAR(32) DEFAULT 'all',
    target_plan_code VARCHAR(64),
    target_id BIGINT DEFAULT 0,
    target_name VARCHAR(255),
    target_recipients TEXT,
    is_broadcast BOOLEAN DEFAULT FALSE,
    status VARCHAR(24) DEFAULT 'published',
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_by BIGINT DEFAULT 0,
    target_audience_count BIGINT DEFAULT 0,
    idempotency_key VARCHAR(128),
    title VARCHAR(255) NOT NULL DEFAULT '',
    category VARCHAR(32) DEFAULT 'SISTEM',
    message TEXT NOT NULL DEFAULT '',
    detail_content TEXT,
    type VARCHAR(32) DEFAULT 'system',
    action_enabled BOOLEAN DEFAULT FALSE,
    action_type VARCHAR(32) DEFAULT 'none',
    link_sub_tab VARCHAR(64),
    link_mobile_settings_tab VARCHAR(64),
    action_label VARCHAR(128),
    action_url VARCHAR(512),
    expires_at TIMESTAMPTZ,
    retention_hours BIGINT DEFAULT 720,
    created_by BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS status VARCHAR(24) DEFAULT 'published';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS revoked_by BIGINT DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_audience_count BIGINT DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);

UPDATE notifications
   SET status = 'published'
 WHERE status IS NULL OR TRIM(status) = '';

UPDATE notifications
   SET published_at = created_at
 WHERE published_at IS NULL
   AND status = 'published'
   AND created_at IS NOT NULL;

DROP INDEX IF EXISTS idx_notifications_expires;
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications (expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_status_sched ON notifications (status, scheduled_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_idempotency_key
    ON notifications (idempotency_key)
    WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';

-- 2. Tabel ternormalisasi notification_recipients (anti LIKE substring & cross-type leak)
CREATE TABLE IF NOT EXISTS notification_recipients (
    id BIGSERIAL PRIMARY KEY,
    notification_id VARCHAR(64) NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    recipient_type VARCHAR(16) NOT NULL,
    recipient_id BIGINT NOT NULL,
    recipient_name VARCHAR(255) DEFAULT '',
    recipient_slug VARCHAR(255) DEFAULT '',
    recipient_email VARCHAR(255) DEFAULT '',
    recipient_plan VARCHAR(64) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_recipient_unique
    ON notification_recipients (notification_id, recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_lookup
    ON notification_recipients (recipient_type, recipient_id, notification_id);

-- Backfill target_recipients JSON lama ke notification_recipients secara aman
DO $$
DECLARE
    rec RECORD;
    elem JSONB;
BEGIN
    FOR rec IN
        SELECT id, target_recipients
        FROM notifications
        WHERE target_type = 'specific'
          AND target_recipients IS NOT NULL
          AND TRIM(target_recipients) LIKE '[%'
    LOOP
        BEGIN
            FOR elem IN SELECT * FROM jsonb_array_elements(rec.target_recipients::jsonb)
            LOOP
                IF COALESCE(elem->>'type', '') IN ('store', 'user')
                   AND COALESCE(elem->>'id', '') ~ '^[0-9]+$'
                   AND (elem->>'id')::BIGINT > 0 THEN
                    INSERT INTO notification_recipients (
                        notification_id, recipient_type, recipient_id,
                        recipient_name, recipient_slug, recipient_email, recipient_plan, created_at
                    )
                    VALUES (
                        rec.id,
                        elem->>'type',
                        (elem->>'id')::BIGINT,
                        COALESCE(elem->>'name', ''),
                        COALESCE(elem->>'slug', ''),
                        COALESCE(elem->>'email', ''),
                        COALESCE(elem->>'plan', ''),
                        NOW()
                    )
                    ON CONFLICT (notification_id, recipient_type, recipient_id) DO NOTHING;
                END IF;
            END LOOP;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Lewati backfill target_recipients untuk %: %', rec.id, SQLERRM;
        END;
    END LOOP;
END $$;

-- 3. Normalisasi & constraint notification_reads (nullable store_id + CTR clicked_at + unique index)
CREATE TABLE IF NOT EXISTS notification_reads (
    id BIGSERIAL PRIMARY KEY,
    notification_id VARCHAR(64) NOT NULL,
    store_id BIGINT REFERENCES stores(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    clicked_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE notification_reads ALTER COLUMN store_id DROP NOT NULL;
UPDATE notification_reads SET store_id = NULL WHERE store_id = 0;
ALTER TABLE notification_reads ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;

-- Bersihkan duplikat sebelum memasang unique index
DELETE FROM notification_reads a
USING notification_reads b
WHERE a.id < b.id
  AND a.notification_id = b.notification_id
  AND a.store_id IS NOT NULL
  AND a.store_id = b.store_id;

DELETE FROM notification_reads a
USING notification_reads b
WHERE a.id < b.id
  AND a.notification_id = b.notification_id
  AND a.store_id IS NULL
  AND b.store_id IS NULL
  AND a.user_id = b.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_reads_notif_store
    ON notification_reads (notification_id, store_id)
    WHERE store_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_reads_notif_user_nostore
    ON notification_reads (notification_id, user_id)
    WHERE store_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_notification_reads_clicked_at
    ON notification_reads (clicked_at);
