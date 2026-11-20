CREATE INDEX IF NOT EXISTS idx_subscription_orders_created_id
  ON subscription_orders (created_at DESC, id DESC);
