-- Migration: Optimize POS Kasir Database Indexes & Query Performance
-- Date: 2026-07-22

-- 1. Index on shifts for fast active shift lookup by outlet
CREATE INDEX IF NOT EXISTS idx_shifts_outlet_status_start 
  ON public.shifts(outlet_id, status, start_time DESC);

-- 2. Index on orders for fast sales queries by outlet & date
CREATE INDEX IF NOT EXISTS idx_orders_outlet_created 
  ON public.orders(outlet_id, created_at DESC);

-- 3. Index on petty cash expenses for fast shift expense lookup
CREATE INDEX IF NOT EXISTS idx_petty_expenses_outlet_created 
  ON public.petty_cash_expenses(outlet_id, created_at DESC);

-- 4. Index on petty cash topups for fast shift topup lookup
CREATE INDEX IF NOT EXISTS idx_petty_topups_outlet_status_created 
  ON public.petty_cash_topups(outlet_id, status, created_at DESC);

-- 5. Index on menu items for fast ordering
CREATE INDEX IF NOT EXISTS idx_menu_items_sort_available 
  ON public.menu_items(sort_order, is_available);
