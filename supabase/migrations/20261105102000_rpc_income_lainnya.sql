-- Income Lainnya: penjualan barang bekas → Kas Office, pendapatan pusat.

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
  IF v_grup IS DISTINCT FROM 'office' THEN
    RAISE EXCEPTION 'Income lainnya harus masuk ke Kas Office';
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
REVOKE EXECUTE ON FUNCTION public.record_income_lainnya(timestamptz, text, text, text, uuid, numeric, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_income_lainnya(timestamptz, text, text, text, uuid, numeric, uuid, text) TO authenticated;

-- Batal: tak pernah DELETE; transaksi kas pasangan di-void (trigger membalik saldo).
CREATE OR REPLACE FUNCTION public.batal_income_lainnya(p_id uuid, p_alasan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_tx uuid;
BEGIN
  IF NOT public.kas_pencatat_ok() THEN
    RAISE EXCEPTION 'Hanya admin finance, admin, atau owner yang boleh membatalkan income lainnya';
  END IF;
  IF btrim(coalesce(p_alasan, '')) = '' THEN RAISE EXCEPTION 'Alasan pembatalan wajib diisi'; END IF;
  SELECT status, cash_transaction_id INTO v_status, v_tx FROM public.income_lainnya WHERE id = p_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Income lainnya tidak ditemukan'; END IF;
  IF v_status <> 'aktif' THEN RAISE EXCEPTION 'Income lainnya sudah dibatalkan'; END IF;

  UPDATE public.income_lainnya
     SET status = 'batal', batal_by = auth.uid(), batal_at = now(), batal_alasan = btrim(p_alasan)
   WHERE id = p_id;
  IF v_tx IS NOT NULL THEN
    UPDATE public.cash_transaction SET status = 'void' WHERE id = v_tx;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.batal_income_lainnya(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.batal_income_lainnya(uuid, text) TO authenticated;
