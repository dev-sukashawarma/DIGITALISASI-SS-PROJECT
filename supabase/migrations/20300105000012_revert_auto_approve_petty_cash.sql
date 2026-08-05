-- Revert 20260804000000_auto_approve_all_petty_cash.sql
--
-- Migration itu membuat `create_petty_cash_topup` menyisipkan topup langsung
-- dengan status 'completed' + completed_at = NOW() DAN langsung menambah saldo
-- petty cash outlet lewat `petty_cash_transactions`. Efeknya seluruh rantai
-- persetujuan (Area Manager -> Finance -> Forward -> Leader -> Crew terima)
-- dilewati, dan kas outlet bertambah tanpa ada pencairan nyata dari treasury
-- (tidak ada baris `cash_transaction` arah 'out').
--
-- Kembalikan ke perilaku 20260722110000: topup dibuat berstatus
-- 'forwarded_to_area_manager' dan saldo baru bertambah saat
-- `leader_forward_funds` dipanggil.

CREATE OR REPLACE FUNCTION public.create_petty_cash_topup(
  p_outlet_id UUID,
  p_amount NUMERIC,
  p_description TEXT,
  p_bank_name TEXT DEFAULT NULL,
  p_bank_account_number TEXT DEFAULT NULL,
  p_bank_account_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topup_id UUID;
  v_caller_staff_id UUID;
BEGIN
  v_caller_staff_id := auth.uid();
  IF v_caller_staff_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Save / update outlet bank details if provided
  IF p_bank_name IS NOT NULL AND p_bank_account_number IS NOT NULL THEN
    UPDATE public.outlets
    SET
      bank_name = p_bank_name,
      bank_account_number = p_bank_account_number,
      bank_account_name = COALESCE(p_bank_account_name, bank_account_name)
    WHERE id = p_outlet_id;
  END IF;

  INSERT INTO public.petty_cash_topups (
    outlet_id,
    amount,
    description,
    status,
    created_by,
    created_at,
    bank_name,
    bank_account_number,
    bank_account_name
  ) VALUES (
    p_outlet_id,
    p_amount,
    p_description,
    'forwarded_to_area_manager',
    v_caller_staff_id,
    NOW(),
    p_bank_name,
    p_bank_account_number,
    p_bank_account_name
  )
  RETURNING id INTO v_topup_id;

  RETURN v_topup_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_petty_cash_topup(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
