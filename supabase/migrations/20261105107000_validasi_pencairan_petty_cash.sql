CREATE OR REPLACE FUNCTION public.finance_process_petty_cash_custom(
  p_topup_id uuid, p_action text, p_method text DEFAULT 'transfer',
  p_cash_location_id uuid DEFAULT NULL, p_proof_of_transfer_url text DEFAULT NULL,
  p_final_amount numeric DEFAULT NULL, p_description text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_topup public.petty_cash_topups%ROWTYPE;
  v_amount numeric;
  v_saldo numeric;
BEGIN
  IF NOT public.kas_pencatat_ok() AND NOT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND status = 'active' AND role = 'developer'
  ) THEN
    RAISE EXCEPTION 'Hanya Finance yang boleh memproses pencairan petty cash';
  END IF;

  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan petty cash tidak ditemukan';
  END IF;
  IF v_topup.status IS DISTINCT FROM 'forwarded_to_finance' THEN
    RAISE EXCEPTION 'Pengajuan tidak siap diproses Finance (status: %)', v_topup.status;
  END IF;

  IF p_action = 'reject' THEN
    UPDATE public.petty_cash_topups
    SET status = 'rejected', finance_approved_by = auth.uid(),
        description = COALESCE(p_description, v_topup.description)
    WHERE id = p_topup_id;
    RETURN;
  END IF;
  IF p_action IS DISTINCT FROM 'approve' THEN
    RAISE EXCEPTION 'Aksi pencairan tidak valid';
  END IF;

  p_method := COALESCE(p_method, 'transfer');
  IF p_method NOT IN ('transfer', 'tunai') THEN
    RAISE EXCEPTION 'Metode pencairan tidak valid';
  END IF;
  PERFORM 1 FROM public.cash_location
  WHERE id = p_cash_location_id AND is_active AND grup = 'petty_cash' AND scope = 'pusat'
    AND kind = CASE p_method WHEN 'transfer' THEN 'bank' ELSE 'cash' END
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pilih sumber Rekening Petty Cash aktif sesuai metode pencairan di dashboard Finance';
  END IF;

  v_amount := COALESCE(p_final_amount, v_topup.amount);
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount > v_topup.amount THEN
    RAISE EXCEPTION 'Nominal disetujui harus lebih dari 0 dan tidak melebihi pengajuan';
  END IF;

  SELECT saldo INTO v_saldo FROM public.cash_balance
  WHERE cash_location_id = p_cash_location_id FOR UPDATE;
  IF v_amount > COALESCE(v_saldo, 0) THEN
    RAISE EXCEPTION 'Saldo Rekening Petty Cash tidak mencukupi';
  END IF;

  UPDATE public.petty_cash_topups
  SET status = 'approved_by_finance', finance_approved_by = auth.uid(),
      disbursement_method = p_method, disbursed_from_cash_location_id = p_cash_location_id,
      proof_of_transfer_url = p_proof_of_transfer_url, amount = v_amount,
      description = COALESCE(p_description, v_topup.description)
  WHERE id = p_topup_id;

  INSERT INTO public.cash_transaction (
    cash_location_id, amount, direction, source_type, source_id, note, occurred_at, created_by, status
  ) VALUES (
    p_cash_location_id, v_amount, 'out', 'petty_cash_topup', p_topup_id,
    'Pencairan Petty Cash Outlet (' || p_method || ')', now(), auth.uid(), 'paid'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_process_petty_cash(
  p_topup_id uuid, p_action text, p_method text DEFAULT 'transfer',
  p_cash_location_id uuid DEFAULT NULL, p_proof_of_transfer_url text DEFAULT NULL
)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT public.finance_process_petty_cash_custom(
    p_topup_id, p_action, p_method, p_cash_location_id, p_proof_of_transfer_url
  );
$$;

REVOKE EXECUTE ON FUNCTION public.finance_process_petty_cash(uuid, text, text, uuid, text)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.finance_process_petty_cash_custom(uuid, text, text, uuid, text, numeric, text)
  FROM PUBLIC, anon;
