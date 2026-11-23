-- The flusher upserts one aggregate per campaign per UTC day.
-- Leave historical rows intact. Existing duplicate keys require reconciliation.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ad_daily_metrics_camp_date
    ON ad_daily_metrics (campaign_id, date);
