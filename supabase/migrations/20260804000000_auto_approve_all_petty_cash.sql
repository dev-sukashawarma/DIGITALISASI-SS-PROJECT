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

  -- Insert topup as completed instantly (Auto-Approval)
  INSERT INTO public.petty_cash_topups (
    outlet_id,
    amount,
    description,
    status,
    created_by,
    created_at,
    bank_name,
    bank_account_number,
    bank_account_name,
    completed_at
  ) VALUES (
    p_outlet_id,
    p_amount,
    p_description,
    'completed',
    v_caller_staff_id,
    NOW(),
    p_bank_name,
    p_bank_account_number,
    p_bank_account_name,
    NOW()
  )
  RETURNING id INTO v_topup_id;

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
      p_outlet_id,
      p_amount,
      'topup',
      'Auto-approved Topup Petty Cash',
      v_caller_staff_id,
      NOW()
    );
  END IF;

  RETURN v_topup_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_petty_cash_topup(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
