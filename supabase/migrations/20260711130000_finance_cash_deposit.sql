-- 20260711130000_finance_cash_deposit.sql
-- M5 Finance P4: setoran tunai Hop-1 (outlet → Kas Pusat). Menambah atribusi outlet
-- pada transaksi kas + RPC khusus setoran. Hop-2 (Kas Pusat → bank) pakai
-- record_cash_transfer yang sudah ada. Aditif.

-- 1. Atribusi outlet pada transaksi kas (nullable — transaksi pusat/bank tak beroutlet).
ALTER TABLE public.cash_transaction
  ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES public.outlets(id);

-- 2. RPC record_cash_deposit: setoran tunai masuk ke lokasi 'cash' (Kas Pusat),
--    atribusi outlet asal + bukti serah-terima opsional. Status pending_approval
--    (divalidasi Pusat lewat alur approval biasa → saldo Kas Pusat naik saat reconciled).
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

  INSERT INTO public.cash_transaction (cash_location_id, direction, amount, category,
    source_type, outlet_id, note, proof_url, status, created_by)
  VALUES (p_location, 'in', p_amount, 'Setoran tunai',
    'cash_deposit', p_outlet, p_note, p_proof_url, 'pending_approval', auth.uid())
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- DOWN:
-- DROP FUNCTION record_cash_deposit(uuid,numeric,uuid,text,text);
-- ALTER TABLE cash_transaction DROP COLUMN outlet_id;
