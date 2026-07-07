-- 20260707000000_petty_cash_magic_link.sql
-- Add approval_token to petty_cash_topups and update get_petty_cash_balance

-- 1. Add approval_token column
ALTER TABLE public.petty_cash_topups 
  ADD COLUMN IF NOT EXISTS approval_token UUID;

-- 2. Update get_petty_cash_balance to ONLY sum 'approved' topups
CREATE OR REPLACE FUNCTION public.get_petty_cash_balance(p_outlet_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topups DECIMAL;
  v_expenses DECIMAL;
BEGIN
  IF p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized to view this outlet';
  END IF;

  -- Only sum approved topups
  SELECT COALESCE(SUM(amount), 0) INTO v_topups
  FROM public.petty_cash_topups
  WHERE outlet_id = p_outlet_id AND status = 'approved';

  SELECT COALESCE(SUM(amount), 0) INTO v_expenses
  FROM public.petty_cash_expenses
  WHERE outlet_id = p_outlet_id;

  RETURN v_topups - v_expenses;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_petty_cash_balance(UUID) TO authenticated;
