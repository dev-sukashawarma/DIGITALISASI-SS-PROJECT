
CREATE OR REPLACE FUNCTION public.get_petty_cash_balance(p_outlet_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $BODY$
DECLARE
  v_topups DECIMAL;
  v_expenses DECIMAL;
BEGIN
  IF p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized to view this outlet';
  END IF;

  -- Only sum approved and completed topups
  SELECT COALESCE(SUM(amount), 0) INTO v_topups
  FROM public.petty_cash_topups
  WHERE outlet_id = p_outlet_id AND status IN ('approved', 'completed');

  SELECT COALESCE(SUM(amount), 0) INTO v_expenses
  FROM public.petty_cash_expenses
  WHERE outlet_id = p_outlet_id;

  RETURN v_topups - v_expenses;
END;
$BODY$;

