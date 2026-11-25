-- N-65: Enterprise Helpdesk Ownership Assignment & Search Scalability Indexes
-- Idempoten untuk upgrade DB produksi (DB_AUTO_MIGRATE=false) maupun skema minimal PostgreSQL.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'support_tickets') THEN
        ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_agent_id BIGINT;
        CREATE INDEX IF NOT EXISTS idx_tickets_assigned_agent ON support_tickets (assigned_agent_id, status);
    END IF;
END $$;

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'support_tickets') THEN
        CREATE INDEX IF NOT EXISTS idx_tickets_subject_trgm ON support_tickets USING gin (LOWER(subject) gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_tickets_number_trgm ON support_tickets USING gin (LOWER(ticket_number) gin_trgm_ops);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'support_messages') THEN
        CREATE INDEX IF NOT EXISTS idx_support_messages_trgm ON support_messages USING gin (LOWER(message) gin_trgm_ops);
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Best-effort trigram extension: abaikan jika ekstensi pg_trgm tidak tersedia atau hak superuser terbatas.
    RAISE NOTICE 'pg_trgm index skipped: %', SQLERRM;
END $$;
