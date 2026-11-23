-- Historical invoice snapshots retained after a catalog closes. No live tenant FK
-- or merchant endpoint can mutate these records through a deleted store.
CREATE TABLE IF NOT EXISTS retained_store_orders (
    order_kind text NOT NULL,
    source_id bigint NOT NULL,
    former_store_id bigint NOT NULL,
    snapshot jsonb NOT NULL,
    archived_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (order_kind, source_id)
);

-- A deleted store cannot be rediscovered by the hourly storage sweep.
CREATE TABLE IF NOT EXISTS pending_store_media_deletions (
    store_id bigint PRIMARY KEY CHECK (store_id > 0),
    last_attempt_at timestamptz
);

CREATE TABLE IF NOT EXISTS pending_owner_media_deletions (
    owner_id bigint PRIMARY KEY CHECK (owner_id > 0),
    support_keys jsonb NOT NULL,
    last_attempt_at timestamptz
);
