-- Tiga rekening kas pusat (keputusan owner 2026-11-05), masing-masing sisi Bank & Cash:
--   Rekening Utama      : Bank 0955193763 — omzet transfer outlet; ditransfer ke Bahan Baku Bank
--   Rekening Bahan Baku : Bank 0955353124 (baru) + Tunai — omzet tunai; bayar bahan baku & payroll
--   Rekening Petty Cash : Bank 0955381004 + Tunai — receh setoran & income lainnya; pencairan petty cash
-- Menggantikan grup 'setoran_outlet' / 'office' (20261105100000). Rekening Utama sisi Cash tidak dibuat.
-- Saldo & riwayat tidak berubah: hanya grup, label, dan tujuan RPC.

ALTER TABLE public.cash_location DROP CONSTRAINT IF EXISTS cash_location_grup_check;
UPDATE public.cash_location SET grup = 'utama',      label = 'Rekening Utama 0955193763'
 WHERE id = 'b0955193-7630-4c0e-9a11-5e70a0000001';
UPDATE public.cash_location SET grup = 'bahan_baku', label = 'Rekening Bahan Baku Tunai'
 WHERE id = 'a64f9484-70e9-4bf7-b62d-2643835a1874';
UPDATE public.cash_location SET grup = 'petty_cash', label = 'Rekening Petty Cash 0955381004'
 WHERE id = 'b0955381-0040-4c0e-9a11-5e70a0000002';
UPDATE public.cash_location SET grup = 'petty_cash', label = 'Rekening Petty Cash Tunai'
 WHERE id = 'b0000000-0ff1-4c0e-9a11-5e70a0000003';
INSERT INTO public.cash_location (id, label, kind, bank_name, account_no, holder_name, scope, outlet_id,
                                  is_active, opening_balance, opening_date, grup)
VALUES ('b0955353-1240-4c0e-9a11-5e70a0000004', 'Rekening Bahan Baku 0955353124', 'bank', NULL, '0955353124',
        'PT SUKA PROFIT BERKAH', 'pusat', NULL, true, 0, '2026-11-01', 'bahan_baku')
ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.cash_location ADD CONSTRAINT cash_location_grup_check
  CHECK (grup IS NULL OR grup IN ('utama', 'bahan_baku', 'petty_cash'));

-- Setoran outlet: transfer → Rekening Utama (bank); tunai → Rekening Bahan Baku Tunai.
CREATE OR REPLACE FUNCTION public.kas_tujuan_setoran_ok(p_location uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.cash_location
                  WHERE id = p_location AND is_active
                    AND ((kind = 'bank' AND grup = 'utama') OR (kind = 'cash' AND grup = 'bahan_baku')));
$$;
REVOKE EXECUTE ON FUNCTION public.kas_tujuan_setoran_ok(uuid) FROM PUBLIC, anon, authenticated;

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
  IF NOT public.kas_tujuan_setoran_ok(p_location) THEN
    RAISE EXCEPTION 'setoran transfer harus ke Rekening Utama, setoran tunai ke Rekening Bahan Baku Tunai';
  END IF;
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

-- Setor ke Bank: Bahan Baku Tunai → Bahan Baku Bank (kelipatan Rp 50.000), receh → Petty Cash Tunai.
CREATE OR REPLACE FUNCTION public.record_setor_bank(
  p_total_diambil numeric, p_nominal_bank numeric, p_proof_url text, p_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sumber uuid; v_bank uuid; v_receh_ke uuid; v_saldo numeric; v_receh numeric; v_id uuid;
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

  v_sumber   := public.kas_lokasi_tunggal('bahan_baku', 'cash');
  v_bank     := public.kas_lokasi_tunggal('bahan_baku', 'bank');
  v_receh_ke := public.kas_lokasi_tunggal('petty_cash', 'cash');

  INSERT INTO public.cash_balance (cash_location_id, saldo, updated_at)
  VALUES (v_sumber, 0, now()) ON CONFLICT (cash_location_id) DO NOTHING;
  SELECT saldo INTO v_saldo FROM public.cash_balance WHERE cash_location_id = v_sumber FOR UPDATE;
  IF p_total_diambil > coalesce(v_saldo, 0) THEN
    RAISE EXCEPTION 'Uang yang diambil melebihi saldo Rekening Bahan Baku Tunai';
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
    VALUES (v_receh_ke, 'in', v_receh, 'Receh Setoran', 'setor_bank', v_id, 'reconciled', p_note, p_proof_url,
      auth.uid(), auth.uid(), now(), auth.uid(), now());
  END IF;
  RETURN v_id;
END $$;

-- Income Lainnya: hanya ke Rekening Petty Cash (bank atau tunai).
CREATE OR REPLACE FUNCTION public.record_income_lainnya(
  p_occurred_at timestamptz, p_kategori text, p_keterangan text, p_pembeli text,
  p_asal_outlet uuid, p_amount numeric, p_cash_location uuid, p_proof_url text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_grup text; v_label text; v_id uuid; v_tx uuid;
BEGIN
  IF NOT public.kas_pencatat_ok() THEN
    RAISE EXCEPTION 'Hanya admin finance, admin, atau owner yang boleh mencatat income lainnya';
  END IF;
  v_label := CASE p_kategori
    WHEN 'minyak_jelantah' THEN 'Minyak Jelantah'
    WHEN 'kardus_bekas'    THEN 'Kardus Bekas'
    WHEN 'kompan_bekas'    THEN 'Kompan/Jerigen Bekas'
    WHEN 'equipment_bekas' THEN 'Equipment Bekas'
    WHEN 'lainnya'         THEN 'Lainnya' END;
  IF v_label IS NULL THEN RAISE EXCEPTION 'Kategori income lainnya tidak dikenal'; END IF;
  IF p_kategori = 'lainnya' AND btrim(coalesce(p_keterangan, '')) = '' THEN
    RAISE EXCEPTION 'Keterangan wajib diisi untuk kategori Lainnya';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Nominal harus lebih dari 0'; END IF;
  IF btrim(coalesce(p_pembeli, '')) = '' THEN RAISE EXCEPTION 'Nama pembeli wajib diisi'; END IF;
  IF btrim(coalesce(p_proof_url, '')) = '' THEN RAISE EXCEPTION 'Bukti wajib dilampirkan'; END IF;

  SELECT grup INTO v_grup FROM public.cash_location WHERE id = p_cash_location AND is_active;
  IF v_grup IS DISTINCT FROM 'petty_cash' THEN
    RAISE EXCEPTION 'Income lainnya harus masuk ke Rekening Petty Cash';
  END IF;

  INSERT INTO public.income_lainnya (occurred_at, kategori, keterangan, pembeli, asal_outlet_id, amount,
    cash_location_id, proof_url, created_by)
  VALUES (coalesce(p_occurred_at, now()), p_kategori, nullif(btrim(p_keterangan), ''), btrim(p_pembeli),
    p_asal_outlet, p_amount, p_cash_location, p_proof_url, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.cash_transaction (cash_location_id, direction, amount, category, source_type, source_id,
    status, occurred_at, outlet_id, note, proof_url, created_by, approved_by, approved_at, reconciled_by, reconciled_at)
  VALUES (p_cash_location, 'in', p_amount, v_label, 'income_lain', v_id, 'reconciled',
    coalesce(p_occurred_at, now()), p_asal_outlet, nullif(btrim(p_keterangan), ''), p_proof_url,
    auth.uid(), auth.uid(), now(), auth.uid(), now())
  RETURNING id INTO v_tx;

  UPDATE public.income_lainnya SET cash_transaction_id = v_tx WHERE id = v_id;
  RETURN v_id;
END $$;

-- Pencairan petty cash: sumber hanya Rekening Petty Cash. Badan = live (20261105103000), grup diganti.
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
      PERFORM public.kas_wajib_grup(p_cash_location_id, 'petty_cash', 'top-up petty cash harus dari Rekening Petty Cash');
    END IF;
    IF p_method IS NULL THEN
      p_method := 'transfer';
    END IF;
    UPDATE public.petty_cash_topups
    SET status = 'approved_by_finance', finance_approved_by = auth.uid(),
        disbursement_method = p_method, disbursed_from_cash_location_id = p_cash_location_id,
        proof_of_transfer_url = p_proof_of_transfer_url
    WHERE id = p_topup_id;
    IF p_cash_location_id IS NOT NULL THEN
      INSERT INTO public.cash_transaction (
        cash_location_id, amount, direction, source_type, source_id, note, occurred_at, created_by
      ) VALUES (
        p_cash_location_id, v_topup.amount, 'out', 'petty_cash_topup', p_topup_id,
        'Pencairan Petty Cash Outlet (' || p_method || ')', NOW(), auth.uid()
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
      PERFORM public.kas_wajib_grup(p_cash_location_id, 'petty_cash', 'top-up petty cash harus dari Rekening Petty Cash');
    END IF;
    IF p_method IS NULL THEN
      p_method := 'transfer';
    END IF;
    v_amount_to_use := COALESCE(p_final_amount, v_topup.amount);
    UPDATE public.petty_cash_topups
    SET status = 'approved_by_finance', finance_approved_by = auth.uid(),
        disbursement_method = p_method, disbursed_from_cash_location_id = p_cash_location_id,
        proof_of_transfer_url = p_proof_of_transfer_url, amount = v_amount_to_use,
        description = COALESCE(p_description, v_topup.description)
    WHERE id = p_topup_id;
    IF p_cash_location_id IS NOT NULL THEN
      INSERT INTO public.cash_transaction (
        cash_location_id, amount, direction, source_type, source_id, note, occurred_at, created_by, status
      ) VALUES (
        p_cash_location_id, v_amount_to_use, 'out', 'petty_cash_topup', p_topup_id,
        'Pencairan Petty Cash Outlet (' || p_method || ')', NOW(), auth.uid(), 'paid'
      );
    END IF;
  ELSIF p_action = 'reject' THEN
    UPDATE public.petty_cash_topups
    SET status = 'rejected', finance_approved_by = auth.uid(),
        description = COALESCE(p_description, v_topup.description)
    WHERE id = p_topup_id;
  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;
END;
$function$;
