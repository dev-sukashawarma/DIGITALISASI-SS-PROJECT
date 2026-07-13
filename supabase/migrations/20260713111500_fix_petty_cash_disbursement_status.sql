-- Fix: Petty cash disbursement should insert cash_transaction with status = 'paid'
-- so that the cash_apply_balance trigger decrements the balance immediately.

CREATE OR REPLACE FUNCTION public.finance_process_petty_cash(
  p_topup_id UUID,
  p_action TEXT, -- 'approve' or 'reject'
  p_method TEXT DEFAULT NULL, -- 'potong_setoran', 'transfer', 'tunai'
  p_cash_location_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS \$\$
DECLARE
  v_topup RECORD;
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
      RAISE EXCEPTION 'Disbursement method is required for approval';
    END IF;

    IF p_method IN ('transfer', 'tunai') AND p_cash_location_id IS NULL THEN
      RAISE EXCEPTION 'Cash location ID is required for transfer/tunai disbursement';
    END IF;

    UPDATE public.petty_cash_topups 
    SET 
      status = 'approved_by_finance', 
      finance_approved_by = auth.uid(),
      disbursement_method = p_method,
      disbursed_from_cash_location_id = p_cash_location_id
    WHERE id = p_topup_id;

    -- If money is taken from Finance Cash Location (transfer/tunai), insert into cash_transaction
    IF p_method IN ('transfer', 'tunai') THEN
      INSERT INTO public.cash_transaction (
        cash_location_id, 
        amount, 
        direction, 
        source_type, 
        source_id, 
        note,
        occurred_at,
        created_by,
        status
      ) VALUES (
        p_cash_location_id,
        v_topup.amount,
        'out',
        'petty_cash_topup',
        p_topup_id,
        'Pencairan Petty Cash ' || p_method || ' - ' || v_topup.description,
        now(),
        auth.uid(),
        'paid'
      );
    END IF;

  ELSIF p_action = 'reject' THEN
    UPDATE public.petty_cash_topups 
    SET status = 'rejected', finance_approved_by = auth.uid()
    WHERE id = p_topup_id;
  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;
END;
\$\$;
GRANT EXECUTE ON FUNCTION public.finance_process_petty_cash(UUID, TEXT, TEXT, UUID) TO authenticated;
