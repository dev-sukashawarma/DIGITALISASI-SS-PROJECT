-- ==============================================================================
-- PHASE 1: DATABASE INDEXING OPTIMIZATION & CLEANUP
-- ==============================================================================

-- 1. DROP DUPLICATE & REDUNDANT INDEXES
-- ------------------------------------------------------------------------------
-- order_items: duplicate on menu_item_id & order_id
DROP INDEX IF EXISTS public.idx_order_items_menu_item;
DROP INDEX IF EXISTS public.idx_order_items_order;

-- orders: duplicate on (outlet_id, created_at DESC)
DROP INDEX IF EXISTS public.idx_orders_outlet_created_at;

-- orders: duplicate unique indexes on external_order_id
DROP INDEX IF EXISTS public.orders_external_order_id_unique_idx;

-- bahan_baku_harga: duplicate on bahan_baku_id (already PK)
DROP INDEX IF EXISTS public.idx_bahan_baku_harga_bahan;


-- 2. CREATE CRITICAL FOREIGN KEY & FILTER INDEXES
-- ------------------------------------------------------------------------------

-- ecommerce_sale_items: currently 0 indexes on FKs, causing massive seq scans
CREATE INDEX IF NOT EXISTS idx_ecommerce_sale_items_sale_id 
  ON public.ecommerce_sale_items (sale_id);

CREATE INDEX IF NOT EXISTS idx_ecommerce_sale_items_menu_id 
  ON public.ecommerce_sale_items (menu_id);

-- cancellation_requests: status filtering & user FK
CREATE INDEX IF NOT EXISTS idx_cancellation_requests_status_created 
  ON public.cancellation_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cancellation_requests_pending 
  ON public.cancellation_requests (created_at DESC) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_cancellation_requests_requested_by 
  ON public.cancellation_requests (requested_by);

-- expenses: shift_id & created_by FKs
CREATE INDEX IF NOT EXISTS idx_expenses_shift_id 
  ON public.expenses (shift_id) WHERE shift_id IS NOT NULL;

-- petty_cash_topups: Approver FKs & fast status lookup
CREATE INDEX IF NOT EXISTS idx_petty_cash_topups_approved_by 
  ON public.petty_cash_topups (approved_by);

CREATE INDEX IF NOT EXISTS idx_petty_cash_topups_finance_approved_by 
  ON public.petty_cash_topups (finance_approved_by);

CREATE INDEX IF NOT EXISTS idx_petty_cash_topups_pending 
  ON public.petty_cash_topups (outlet_id, created_at DESC) 
  WHERE status IN ('pending', 'forwarded_by_leader');

-- ledger_stok: Partial index for opname lookup (accelerates last_opname_date & saldo_is_gram)
CREATE INDEX IF NOT EXISTS idx_ledger_stok_opname_selisih 
  ON public.ledger_stok (outlet_id, bahan_baku_id, created_at DESC) 
  WHERE tipe = 'opname_selisih';

-- cash_transaction: FK lookups
CREATE INDEX IF NOT EXISTS idx_cash_transaction_outlet_id 
  ON public.cash_transaction (outlet_id);

CREATE INDEX IF NOT EXISTS idx_cash_transaction_created_by 
  ON public.cash_transaction (created_by);

CREATE INDEX IF NOT EXISTS idx_cash_transaction_approved_by 
  ON public.cash_transaction (approved_by);

-- shifts: staff & closer FKs
CREATE INDEX IF NOT EXISTS idx_shifts_staff_id 
  ON public.shifts (staff_id);

CREATE INDEX IF NOT EXISTS idx_shifts_closed_by 
  ON public.shifts (closed_by);

-- purchase_order: transaction & creator FKs
CREATE INDEX IF NOT EXISTS idx_purchase_order_cash_tx 
  ON public.purchase_order (cash_transaction_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_dibuat_oleh 
  ON public.purchase_order (dibuat_oleh);

CREATE INDEX IF NOT EXISTS idx_purchase_order_disetujui_finance 
  ON public.purchase_order (disetujui_finance_oleh);

-- menu_items: category & outlet FKs
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id 
  ON public.menu_items (category_id);

CREATE INDEX IF NOT EXISTS idx_menu_items_outlet_id 
  ON public.menu_items (outlet_id);


-- 3. COVERING & FUNCTIONAL INDEXES FOR REPORTING & DASHBOARD
-- ------------------------------------------------------------------------------

-- orders: Composite covering index for order dashboard range queries
CREATE INDEX IF NOT EXISTS idx_orders_outlet_status_created_covering
  ON public.orders (outlet_id, status, created_at DESC)
  INCLUDE (total_amount, discount_amount, promo_subsidy, channel, sales_source, is_endorse);

-- orders: Status + created_at covering index for multi-outlet / global queries
CREATE INDEX IF NOT EXISTS idx_orders_status_created_covering
  ON public.orders (status, created_at DESC)
  INCLUDE (outlet_id, total_amount, discount_amount, promo_subsidy, channel, sales_source, is_endorse);

-- orders: Functional index on Jakarta timezone date for instant group-by date
CREATE INDEX IF NOT EXISTS idx_orders_outlet_bizdate
  ON public.orders (outlet_id, ((created_at AT TIME ZONE 'Asia/Jakarta')::date));


-- 4. UPDATE STATISTICS
-- ------------------------------------------------------------------------------
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.ledger_stok;
ANALYZE public.stok_balance;
ANALYZE public.ecommerce_sales;
ANALYZE public.ecommerce_sale_items;
ANALYZE public.petty_cash_expenses;
ANALYZE public.petty_cash_topups;
ANALYZE public.cancellation_requests;
ANALYZE public.shifts;
