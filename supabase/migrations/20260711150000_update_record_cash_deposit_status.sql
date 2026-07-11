-- 20260711150000_update_record_cash_deposit_status.sql
-- Update record_cash_deposit to skip approval (set status to reconciled immediately)

CREATE OR REPLACE FUNCTION public.record_cash_deposit(
  p_location uuid, p_amount numeric, p_outlet uuid DEFAULT NULL,
  p_note text DEFAULT NULL, p_proof_url text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_kind text; new_id uuid;
BEGIN
  IF NOT public.is_finance() THEN RAISE EXCEPTION 'forbidden: bukan finance'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'nominal harus > 0'; END IF;

  SELECT kind INTO v_kind FROM public.cash_location WHERE id = p_location;
  IF v_kind IS NULL THEN RAISE EXCEPTION 'lokasi tak ditemukan'; END IF;
  IF v_kind <> 'cash' THEN RAISE EXCEPTION 'setoran tunai harus ke lokasi kas (bukan bank)'; END IF;

  -- Bypassing approval process. 
  -- Status directly becomes 'reconciled' so the cash balance is updated instantly.
  INSERT INTO public.cash_transaction (cash_location_id, direction, amount, category,
    source_type, outlet_id, note, proof_url, status, created_by, approved_by, approved_at, reconciled_by, reconciled_at)
  VALUES (p_location, 'in', p_amount, 'Setoran tunai',
    'cash_deposit', p_outlet, p_note, p_proof_url, 'reconciled', auth.uid(), auth.uid(), now(), auth.uid(), now())
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;
