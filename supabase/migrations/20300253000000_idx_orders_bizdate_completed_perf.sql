-- Migration: 20300253000000_idx_orders_bizdate_completed_perf.sql
-- Description: Composite expression index on completed orders by business date (Asia/Jakarta) and outlet_id.
-- Optimizes queries on `sales_daily_spv`, `sales_daily_scoped`, and PnL reporting by eliminating
-- sequential table scans over 98,000+ orders and accelerating date-range filtering.

CREATE INDEX IF NOT EXISTS idx_orders_bizdate_outlet_completed
  ON public.orders ((((created_at AT TIME ZONE 'Asia/Jakarta'::text))::date), outlet_id)
  WHERE (status = 'completed'::text);

ANALYZE public.orders;
