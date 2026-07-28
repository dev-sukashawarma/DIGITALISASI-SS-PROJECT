-- 20260728120000_finance_process_petty_cash_custom.sql
-- Create a new RPC to handle custom amounts and descriptions for finance processing
CREATE OR REPLACE FUNCTION public.finance_process_petty_cash_custom(
  p_topup_id UUID,
  p_action TEXT,
  p_method TEXT DEFAULT 'transfer',
  p_cash_location_id UUID DEFAULT NULL,
  p_proof_of_transfer_url TEXT DEFAULT NULL,
  p_final_amount NUMERIC DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topup RECORD;
  v_amount_to_use NUMERIC;
BEGIN
  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top up request not found';
  END IF;

  IF v_topup.status != 'forwarded_to_finance' THEN
    RAISE EXCEPTION 'Top up is not ready for finance processing (status: %)', v_topup.status;
  END IF;

  IF p_action = 'approve' THEN
    IF p_method IS NULL THEN
      p_method := 'transfer';
    END IF;

    v_amount_to_use := COALESCE(p_final_amount, v_topup.amount);

    UPDATE public.petty_cash_topups 
    SET 
      status = 'approved_by_finance', 
      finance_approved_by = auth.uid(),
      disbursement_method = p_method,
      disbursed_from_cash_location_id = p_cash_location_id,
      proof_of_transfer_url = p_proof_of_transfer_url,
      amount = v_amount_to_use,
      description = COALESCE(p_description, v_topup.description)
    WHERE id = p_topup_id;

    -- Record Cash Out in Finance Treasury if location specified
    IF p_cash_location_id IS NOT NULL THEN
      INSERT INTO public.cash_transaction (
        cash_location_id, 
        amount, 
        direction, 
        source_type, 
        source_id, 
        note,
        occurred_at,
        created_by
      ) VALUES (
        p_cash_location_id,
        v_amount_to_use,
        'out',
        'petty_cash_topup',
        p_topup_id,
        'Pencairan Petty Cash Outlet (' || p_method || ')',
        NOW(),
        auth.uid()
      );
    END IF;

  ELSIF p_action = 'reject' THEN
    UPDATE public.petty_cash_topups 
    SET 
      status = 'rejected', 
      finance_approved_by = auth.uid(),
      description = COALESCE(p_description, v_topup.description)
    WHERE id = p_topup_id;
  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.finance_process_petty_cash_custom(UUID, TEXT, TEXT, UUID, TEXT, NUMERIC, TEXT) TO authenticated;
