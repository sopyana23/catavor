-- Migrasi idempoten: tabel store_daily_traffic_sources (N-26)
--
-- Latar belakang: DB_AUTO_MIGRATE=false pada environment ini, sehingga model
-- models.StoreDailyTrafficSource tidak pernah dibuatkan tabelnya. Akibatnya
-- StoreHandler.DeleteStore gagal (transaksi ter-abort) dan menghapus toko
-- selalu mengembalikan 500.
--
-- Aman dijalankan berulang (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS store_daily_traffic_sources (
    id            BIGSERIAL PRIMARY KEY,
    store_id      BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    date          VARCHAR(10) NOT NULL,
    source        VARCHAR(50) NOT NULL,
    views         BIGINT NOT NULL DEFAULT 0,
    total_actions BIGINT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_traffic_store_date_source
    ON store_daily_traffic_sources (store_id, date, source);
