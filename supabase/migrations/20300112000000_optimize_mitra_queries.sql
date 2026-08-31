-- Optimization for Mitra P&L and ROI queries

-- 1. Index for orders (status = 'completed')
CREATE INDEX IF NOT EXISTS idx_orders_completed_composite 
ON public.orders (outlet_id, created_at DESC) 
WHERE status = 'completed';

-- 2. Index for expenses (type = 'out')
CREATE INDEX IF NOT EXISTS idx_expenses_out_composite 
ON public.expenses (outlet_id, expense_date DESC)
WHERE type = 'out';

-- 3. Index for petty_cash_expenses (deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_petty_cash_active_composite
ON public.petty_cash_expenses (outlet_id, expense_date DESC)
WHERE deleted_at IS NULL;

-- 4. Index for mitra_investments and mitra_transfers if not exist
CREATE INDEX IF NOT EXISTS idx_mitra_investments_outlet_id ON public.mitra_investments(outlet_id);
CREATE INDEX IF NOT EXISTS idx_mitra_transfers_outlet_id ON public.mitra_transfers(outlet_id);
