-- N-68: Enforce append-only audit trail integrity, tamper-evident hash-chain columns,
-- non-cascading historical snapshots, and cold retention archive storage.
-- Idempotent for both fresh empty databases (DB_AUTO_MIGRATE=true/false) and existing production DBs.

-- 1. Ensure activity_logs and policy_audit_logs exist even when DB_AUTO_MIGRATE=false on a fresh DB.
CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGSERIAL PRIMARY KEY,
    store_id BIGINT,
    user_id BIGINT,
    actor_role VARCHAR(50) DEFAULT 'merchant',
    actor_name VARCHAR(255) NOT NULL DEFAULT '',
    actor_email VARCHAR(255) DEFAULT '',
    action VARCHAR(100) NOT NULL DEFAULT '',
    category VARCHAR(50) NOT NULL DEFAULT '',
    entity_type VARCHAR(50) DEFAULT '',
    entity_id BIGINT,
    entity_title VARCHAR(255) DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    changes JSONB,
    ip_address VARCHAR(100) DEFAULT '',
    user_agent TEXT DEFAULT '',
    chain_seq BIGINT NOT NULL DEFAULT 0,
    prev_hash VARCHAR(64) NOT NULL DEFAULT '',
    entry_hash VARCHAR(64) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS policy_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    policy_type VARCHAR(50) NOT NULL DEFAULT '',
    action VARCHAR(50) NOT NULL DEFAULT '',
    old_version VARCHAR(50) DEFAULT '',
    new_version VARCHAR(50) DEFAULT '',
    change_summary TEXT DEFAULT '',
    changed_fields JSONB,
    admin_email VARCHAR(255) DEFAULT '',
    admin_ip VARCHAR(100) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add tamper-evident chain columns idempotently on existing activity_logs.
DO $$
BEGIN
    IF to_regclass('public.activity_logs') IS NOT NULL
       AND (SELECT relkind FROM pg_class WHERE oid = to_regclass('public.activity_logs')) = 'r' THEN
        ALTER TABLE activity_logs
            ADD COLUMN IF NOT EXISTS chain_seq BIGINT NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64) NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS entry_hash VARCHAR(64) NOT NULL DEFAULT '';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_activity_store_created ON activity_logs(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_category ON activity_logs(category);
CREATE INDEX IF NOT EXISTS idx_activity_role ON activity_logs(actor_role);
CREATE INDEX IF NOT EXISTS idx_activity_chain_seq ON activity_logs(chain_seq);
CREATE INDEX IF NOT EXISTS idx_activity_entry_hash ON activity_logs(entry_hash);

-- 3. Drop cascading / mutating foreign keys on activity_logs so deleting a store or user
-- never deletes historical audit records or conflicts with the append-only UPDATE/DELETE guard.
DO $$
DECLARE
    fk RECORD;
BEGIN
    IF to_regclass('public.activity_logs') IS NOT NULL
       AND (SELECT relkind FROM pg_class WHERE oid = to_regclass('public.activity_logs')) = 'r' THEN
        FOR fk IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = to_regclass('public.activity_logs')
              AND contype = 'f'
        LOOP
            EXECUTE format('ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS %I', fk.conname);
        END LOOP;
    END IF;
END $$;

-- 4. Cold archive table for aged operational audit records pruned from hot activity_logs.
CREATE TABLE IF NOT EXISTS archived_activity_logs (
    id BIGSERIAL PRIMARY KEY,
    original_id BIGINT NOT NULL UNIQUE,
    store_id BIGINT,
    user_id BIGINT,
    actor_role VARCHAR(50) DEFAULT '',
    actor_name VARCHAR(255) NOT NULL DEFAULT '',
    actor_email VARCHAR(255) DEFAULT '',
    action VARCHAR(100) NOT NULL DEFAULT '',
    category VARCHAR(50) NOT NULL DEFAULT '',
    entity_type VARCHAR(50) DEFAULT '',
    entity_id BIGINT,
    entity_title VARCHAR(255) DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    changes JSONB,
    ip_address VARCHAR(100) DEFAULT '',
    user_agent TEXT DEFAULT '',
    chain_seq BIGINT NOT NULL DEFAULT 0,
    prev_hash VARCHAR(64) NOT NULL DEFAULT '',
    entry_hash VARCHAR(64) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_archived_activity_created ON archived_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archived_activity_store ON archived_activity_logs(store_id);

-- 5. Append-only database triggers blocking all in-place UPDATEs and all unauthorized DELETEs.
-- Only transactional archival retention cleanup explicitly sets
-- `SET LOCAL catavor.audit_retention_purge = 'authorized'` after copying rows to archived_activity_logs.
CREATE OR REPLACE FUNCTION fn_protect_audit_trail_append_only()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'audit trail is append-only: UPDATE is forbidden on %', TG_TABLE_NAME
            USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME = 'activity_logs'
           AND current_setting('catavor.audit_retention_purge', true) = 'authorized' THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION 'audit trail is append-only: unauthorized DELETE is forbidden on %', TG_TABLE_NAME
            USING ERRCODE = '42501';
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_activity_logs_append_only ON activity_logs;
CREATE TRIGGER trg_activity_logs_append_only
    BEFORE UPDATE OR DELETE ON activity_logs
    FOR EACH ROW
    EXECUTE FUNCTION fn_protect_audit_trail_append_only();

DROP TRIGGER IF EXISTS trg_policy_audit_logs_append_only ON policy_audit_logs;
CREATE TRIGGER trg_policy_audit_logs_append_only
    BEFORE UPDATE OR DELETE ON policy_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION fn_protect_audit_trail_append_only();

DROP TRIGGER IF EXISTS trg_archived_activity_logs_append_only ON archived_activity_logs;
CREATE TRIGGER trg_archived_activity_logs_append_only
    BEFORE UPDATE OR DELETE ON archived_activity_logs
    FOR EACH ROW
    EXECUTE FUNCTION fn_protect_audit_trail_append_only();
