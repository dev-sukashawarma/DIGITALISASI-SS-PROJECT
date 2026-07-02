-- 20260702050000_fix_expenses_constraints.sql

-- 1. Drop category check constraint that might be out of sync
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check1;

-- 2. Drop period_month NOT NULL constraint and set a valid default (if it exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'period_month') THEN
    ALTER TABLE public.expenses ALTER COLUMN period_month DROP NOT NULL;
    ALTER TABLE public.expenses ALTER COLUMN period_month SET DEFAULT date_trunc('month', CURRENT_DATE)::date;
    
    -- Update existing nulls
    UPDATE public.expenses 
    SET period_month = date_trunc('month', expense_date)::date
    WHERE period_month IS NULL;
  END IF;
END $$;
