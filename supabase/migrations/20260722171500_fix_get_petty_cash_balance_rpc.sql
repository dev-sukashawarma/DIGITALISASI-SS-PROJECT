-- 20260722171500_fix_get_petty_cash_balance_rpc.sql
-- Fix get_petty_cash_balance to query petty_cash_expenses and calculate live active shift balance accurately

CREATE OR REPLACE FUNCTION public.get_petty_cash_balance(p_outlet_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topups DECIMAL := 0;
  v_expenses DECIMAL := 0;
  v_starting DECIMAL := 0;
  v_shift_start TIMESTAMPTZ;
  v_shift_id UUID;
BEGIN
  -- Ambil shift yang sedang open
  SELECT id, COALESCE(starting_petty_cash, 0), start_time 
  INTO v_shift_id, v_starting, v_shift_start
  FROM public.shifts 
  WHERE outlet_id = p_outlet_id AND status = 'open' 
  ORDER BY start_time DESC
  LIMIT 1;

  IF v_shift_id IS NOT NULL THEN
    -- Topup selama shift ini
    SELECT COALESCE(SUM(amount), 0) INTO v_topups
    FROM public.petty_cash_topups
    WHERE outlet_id = p_outlet_id 
      AND status IN ('completed', 'approved', 'forwarded_by_leader')
      AND created_at >= v_shift_start;

    -- Pengeluaran selama shift ini
    SELECT COALESCE(SUM(amount), 0) INTO v_expenses
    FROM public.petty_cash_expenses
    WHERE outlet_id = p_outlet_id 
      AND created_at >= v_shift_start;

    RETURN v_starting + v_topups - v_expenses;
  ELSE
    RETURN 0;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_petty_cash_balance(UUID) TO authenticated;
