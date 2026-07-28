-- 20260728000000_auto_complete_petty_cash.sql
-- Automatically set petty cash topup status to 'completed' when leader forwards it.

CREATE OR REPLACE FUNCTION public.leader_forward_funds(
  p_topup_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topup RECORD;
  v_caller_role TEXT;
BEGIN
  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top up request not found';
  END IF;

  IF v_topup.status != 'forwarded_by_area_manager' THEN
    RAISE EXCEPTION 'Top up is not ready for Leader forwarding (status: %)', v_topup.status;
  END IF;

  SELECT role INTO v_caller_role FROM public.outlet_staff WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('leader', 'area_manager', 'korlap', 'admin', 'admin_finance', 'owner') THEN
    RAISE EXCEPTION 'Not authorized to forward Leader funds';
  END IF;

  -- Update topup status directly to 'completed'
  UPDATE public.petty_cash_topups 
  SET 
    status = 'completed', 
    leader_forwarded_by = auth.uid(),
    leader_forwarded_at = NOW(),
    completed_at = NOW()
  WHERE id = p_topup_id;

  -- Increase Petty Cash balance of the outlet
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'petty_cash_transactions') THEN
    INSERT INTO public.petty_cash_transactions (
      outlet_id,
      amount,
      type,
      description,
      created_by,
      created_at
    ) VALUES (
      v_topup.outlet_id,
      v_topup.amount,
      'topup',
      'Topup Petty Cash diserahkan oleh Leader (Otomatis Selesai)',
      auth.uid(),
      NOW()
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.leader_forward_funds(UUID) TO authenticated;
