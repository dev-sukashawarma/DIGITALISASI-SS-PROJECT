CREATE OR REPLACE FUNCTION public.get_all_latest_petty_cash_balances()
RETURNS TABLE (
  outlet_id UUID,
  balance DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH latest_shifts AS (
    SELECT DISTINCT ON (s.outlet_id)
      s.outlet_id,
      s.id as shift_id,
      COALESCE(s.starting_petty_cash, 0) as starting_petty_cash,
      s.start_time
    FROM public.shifts s
    ORDER BY s.outlet_id, s.start_time DESC
  ),
  topups AS (
    SELECT ls.outlet_id, COALESCE(SUM(t.amount), 0) as total_topup
    FROM latest_shifts ls
    LEFT JOIN public.petty_cash_topups t 
      ON t.outlet_id = ls.outlet_id 
      AND t.status IN ('completed', 'approved', 'approved_by_finance', 'forwarded_by_leader')
      AND (t.created_at >= ls.start_time OR t.completed_at >= ls.start_time)
    GROUP BY ls.outlet_id
  ),
  expenses AS (
    SELECT ls.outlet_id, COALESCE(SUM(e.amount), 0) as total_expense
    FROM latest_shifts ls
    LEFT JOIN public.petty_cash_expenses e
      ON e.outlet_id = ls.outlet_id
      AND e.created_at >= ls.start_time
    GROUP BY ls.outlet_id
  )
  SELECT 
    ls.outlet_id,
    (ls.starting_petty_cash + COALESCE(t.total_topup, 0) - COALESCE(e.total_expense, 0)) as balance
  FROM latest_shifts ls
  LEFT JOIN topups t ON t.outlet_id = ls.outlet_id
  LEFT JOIN expenses e ON e.outlet_id = ls.outlet_id;
END;
$$;
