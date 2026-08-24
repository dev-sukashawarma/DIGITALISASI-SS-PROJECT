-- supabase/migrations/20300109000001_index_orders_status_created.sql
-- Non-destructive: hanya tambah index. IF NOT EXISTS = idempoten.
-- Mempercepat query global dashboard (semua outlet) yang filter status + created_at
-- tanpa outlet_id spesifik.

CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders (status, created_at DESC);

-- Index pendukung: petty_cash_expenses outlet + expense_date (dipakai OPEX dashboard)
CREATE INDEX IF NOT EXISTS idx_petty_expenses_outlet_date
  ON public.petty_cash_expenses (outlet_id, expense_date);

NOTIFY pgrst, 'reload schema';
