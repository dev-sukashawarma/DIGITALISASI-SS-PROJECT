-- Setor ke Bank: tunai Kas Setoran Tunai → Rekening Setoran (kelipatan Rp 50.000),
-- sisa receh → Kas Office Tunai. Satu operasi atomik.

-- Penjaga role pencatat uang kas pusat (sengaja BUKAN is_finance(), yang memuat spv/leader).
CREATE OR REPLACE FUNCTION public.kas_pencatat_ok()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.outlet_staff
                  WHERE id = auth.uid() AND status = 'active'
                    AND role IN ('admin_finance', 'admin', 'owner'));
$$;
REVOKE EXECUTE ON FUNCTION public.kas_pencatat_ok() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kas_pencatat_ok() TO authenticated;

-- Satu-satunya lokasi aktif untuk (grup, kind); raise bila tidak tepat satu.
CREATE OR REPLACE FUNCTION public.kas_lokasi_tunggal(p_grup text, p_kind text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_ids FROM public.cash_location
   WHERE is_active AND grup = p_grup AND kind = p_kind;
  IF coalesce(array_length(v_ids, 1), 0) <> 1 THEN
    RAISE EXCEPTION 'lokasi % (%) aktif harus tepat satu, ditemukan %', p_grup, p_kind,
      coalesce(array_length(v_ids, 1), 0);
  END IF;
  RETURN v_ids[1];
END $$;
REVOKE EXECUTE ON FUNCTION public.kas_lokasi_tunggal(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_setor_bank(
  p_total_diambil numeric, p_nominal_bank numeric, p_proof_url text, p_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sumber uuid; v_bank uuid; v_office uuid; v_saldo numeric; v_receh numeric; v_id uuid;
BEGIN
  IF NOT public.kas_pencatat_ok() THEN
    RAISE EXCEPTION 'Hanya admin finance, admin, atau owner yang boleh mencatat setor ke bank';
  END IF;
  IF p_proof_url IS NULL OR btrim(p_proof_url) = '' THEN
    RAISE EXCEPTION 'Bukti setoran bank wajib dilampirkan';
  END IF;
  IF p_nominal_bank IS NULL OR p_nominal_bank <= 0 THEN
    RAISE EXCEPTION 'Nominal ke bank harus lebih dari 0';
  END IF;
  IF mod(p_nominal_bank, 50000) <> 0 THEN
    RAISE EXCEPTION 'Nominal ke bank harus kelipatan Rp 50.000';
  END IF;
  IF p_total_diambil IS NULL OR p_nominal_bank > p_total_diambil THEN
    RAISE EXCEPTION 'Nominal ke bank tidak boleh melebihi uang yang diambil';
  END IF;

  v_sumber := public.kas_lokasi_tunggal('setoran_outlet', 'cash');
  v_bank   := public.kas_lokasi_tunggal('setoran_outlet', 'bank');
  v_office := public.kas_lokasi_tunggal('office', 'cash');

  -- Kunci saldo sumber: dua setor bersamaan tak bisa sama-sama lolos.
  INSERT INTO public.cash_balance (cash_location_id, saldo, updated_at)
  VALUES (v_sumber, 0, now()) ON CONFLICT (cash_location_id) DO NOTHING;
  SELECT saldo INTO v_saldo FROM public.cash_balance WHERE cash_location_id = v_sumber FOR UPDATE;
  IF p_total_diambil > coalesce(v_saldo, 0) THEN
    RAISE EXCEPTION 'Uang yang diambil melebihi saldo Kas Setoran Tunai';
  END IF;

  v_receh := p_total_diambil - p_nominal_bank;
  INSERT INTO public.setor_bank (total_diambil, nominal_bank, receh, proof_url, note, created_by)
  VALUES (p_total_diambil, p_nominal_bank, v_receh, p_proof_url, p_note, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.cash_transaction (cash_location_id, direction, amount, category, source_type, source_id,
    status, note, proof_url, created_by, approved_by, approved_at, reconciled_by, reconciled_at)
  VALUES
    (v_sumber, 'out', p_total_diambil, 'Setor ke Bank', 'setor_bank', v_id, 'reconciled', p_note, p_proof_url,
     auth.uid(), auth.uid(), now(), auth.uid(), now()),
    (v_bank, 'in', p_nominal_bank, 'Setor ke Bank', 'setor_bank', v_id, 'reconciled', p_note, p_proof_url,
     auth.uid(), auth.uid(), now(), auth.uid(), now());
  IF v_receh > 0 THEN
    INSERT INTO public.cash_transaction (cash_location_id, direction, amount, category, source_type, source_id,
      status, note, proof_url, created_by, approved_by, approved_at, reconciled_by, reconciled_at)
    VALUES (v_office, 'in', v_receh, 'Receh Setoran', 'setor_bank', v_id, 'reconciled', p_note, p_proof_url,
      auth.uid(), auth.uid(), now(), auth.uid(), now());
  END IF;
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_setor_bank(numeric, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_setor_bank(numeric, numeric, text, text) TO authenticated;
