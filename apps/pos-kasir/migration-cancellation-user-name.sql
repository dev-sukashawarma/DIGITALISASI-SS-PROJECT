-- ============================================================
-- MIGRATION: ADD CANCELLATION USER NAME TO ORDERS
-- ============================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_user_name TEXT;
