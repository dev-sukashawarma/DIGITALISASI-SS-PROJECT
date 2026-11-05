-- Penjaga grup kas di DB (bukan hanya disembunyikan di UI):
--  * setoran outlet hanya ke grup 'setoran_outlet'
--  * top-up petty cash hanya keluar dari grup 'office'
-- Badan fungsi = definisi live 2026-11-05 + satu cek. Hak akses tak diubah.

CREATE OR REPLACE FUNCTION public.kas_wajib_grup(p_location uuid, p_grup text, p_pesan text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cash_location
                  WHERE id = p_location AND is_active AND grup = p_grup) THEN
    RAISE EXCEPTION '%', p_pesan;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.kas_wajib_grup(uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_cash_deposit(p_location uuid, p_amount numeric, p_outlet uuid, p_note text DEFAULT NULL::text, p_proof_url text DEFAULT NULL::text, p_sales_date date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_kind text; v_scope text; v_cat text; new_id uuid;
BEGIN
  IF NOT public.is_finance() THEN RAISE EXCEPTION 'forbidden: bukan finance'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'nominal harus > 0'; END IF;
  IF p_outlet IS NULL THEN RAISE EXCEPTION 'outlet asal setoran wajib diisi'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.outlets WHERE id = p_outlet) THEN
    RAISE EXCEPTION 'outlet tak ditemukan';
  END IF;
  SELECT kind, scope INTO v_kind, v_scope FROM public.cash_location WHERE id = p_location AND is_active;
  IF v_kind IS NULL THEN RAISE EXCEPTION 'lokasi tujuan tak ditemukan / nonaktif'; END IF;
  IF v_scope IS DISTINCT FROM 'pusat' THEN
    RAISE EXCEPTION 'setoran harus ke rekening/kas pusat, bukan kas kecil outlet';
  END IF;
  PERFORM public.kas_wajib_grup(p_location, 'setoran_outlet', 'setoran outlet harus ke Kas Setoran Outlet');
  v_cat := CASE WHEN v_kind = 'bank' THEN 'Setoran Bank' ELSE 'Setoran Tunai' END;
  INSERT INTO public.cash_transaction (
    cash_location_id, direction, amount, category,
    source_type, outlet_id, note, proof_url, status, sales_date,
    created_by, approved_by, approved_at, reconciled_by, reconciled_at
  ) VALUES (
    p_location, 'in', p_amount, v_cat,
    'cash_deposit', p_outlet, p_note, p_proof_url, 'reconciled', p_sales_date,
    auth.uid(), auth.uid(), now(), auth.uid(), now()
  ) RETURNING id INTO new_id;
  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finance_process_petty_cash(p_topup_id uuid, p_action text, p_method text DEFAULT 'transfer'::text, p_cash_location_id uuid DEFAULT NULL::uuid, p_proof_of_transfer_url text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF p_cash_location_id IS NOT NULL THEN
      PERFORM public.kas_wajib_grup(p_cash_location_id, 'office', 'top-up petty cash harus dari Kas Office');
    END IF;
    IF p_method IS NULL THEN
      p_method := 'transfer';
    END IF;

    UPDATE public.petty_cash_topups
    SET
      status = 'approved_by_finance',
      finance_approved_by = auth.uid(),
      disbursement_method = p_method,
      disbursed_from_cash_location_id = p_cash_location_id,
      proof_of_transfer_url = p_proof_of_transfer_url
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
        v_topup.amount,
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
    SET status = 'rejected', finance_approved_by = auth.uid()
    WHERE id = p_topup_id;
  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finance_process_petty_cash_custom(p_topup_id uuid, p_action text, p_method text DEFAULT 'transfer'::text, p_cash_location_id uuid DEFAULT NULL::uuid, p_proof_of_transfer_url text DEFAULT NULL::text, p_final_amount numeric DEFAULT NULL::numeric, p_description text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF p_cash_location_id IS NOT NULL THEN
      PERFORM public.kas_wajib_grup(p_cash_location_id, 'office', 'top-up petty cash harus dari Kas Office');
    END IF;
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
        created_by,
        status
      ) VALUES (
        p_cash_location_id,
        v_amount_to_use,
        'out',
        'petty_cash_topup',
        p_topup_id,
        'Pencairan Petty Cash Outlet (' || p_method || ')',
        NOW(),
        auth.uid(),
        'paid'
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
$function$;
