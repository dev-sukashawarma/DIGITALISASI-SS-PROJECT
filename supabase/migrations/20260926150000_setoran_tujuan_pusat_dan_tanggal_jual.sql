-- 20260926150000_setoran_tujuan_pusat_dan_tanggal_jual.sql
--
-- Tab Setoran (apps/finance /setoran) tidak pernah bisa menyimpan setoran
-- transfer: form memilih rekening bank pusat, sedangkan record_cash_deposit
-- yang live masih menolak lokasi selain 'cash' ("setoran tunai harus ke lokasi
-- kas (bukan bank)"). Akibatnya sejak Juli hanya 2 baris cash_deposit tercatat.
--
-- 20260921100000_allow_bank_in_cash_deposit sudah menulis perbaikannya dan
-- TERSTEMPEL di schema_migrations, tetapi badan fungsinya tak pernah berubah di
-- DB (diverifikasi 2026-09-26 via pg_get_functiondef). Migration ini
-- menggantikannya.
--
-- Perubahan:
--   1. cash_transaction.sales_date (nullable): tanggal penjualan/tutup shift
--      yang disetor. Setoran diserahkan H+1, jadi tanggal catat != tanggal jual;
--      tanpa kolom ini setoran tak bisa dicocokkan ke shift malam H.
--   2. record_cash_deposit: tujuan boleh bank ATAU tunai, tapi HANYA lokasi
--      scope='pusat' yang aktif (bukan kas kecil outlet). Outlet asal wajib.
--   3. EXECUTE dicabut dari PUBLIC/anon.

ALTER TABLE public.cash_transaction
  ADD COLUMN IF NOT EXISTS sales_date date;

COMMENT ON COLUMN public.cash_transaction.sales_date IS
  'Tanggal penjualan (WIB) yang disetor, untuk source_type=cash_deposit. NULL untuk transaksi lain dan setoran sebelum 2026-09-26.';

DROP FUNCTION IF EXISTS public.record_cash_deposit(uuid, numeric, uuid, text, text);

CREATE FUNCTION public.record_cash_deposit(
  p_location   uuid,
  p_amount     numeric,
  p_outlet     uuid,
  p_note       text DEFAULT NULL,
  p_proof_url  text DEFAULT NULL,
  p_sales_date date DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kind  text;
  v_scope text;
  v_cat   text;
  new_id  uuid;
BEGIN
  IF NOT public.is_finance() THEN RAISE EXCEPTION 'forbidden: bukan finance'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'nominal harus > 0'; END IF;
  IF p_outlet IS NULL THEN RAISE EXCEPTION 'outlet asal setoran wajib diisi'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.outlets WHERE id = p_outlet) THEN
    RAISE EXCEPTION 'outlet tak ditemukan';
  END IF;

  SELECT kind, scope INTO v_kind, v_scope
    FROM public.cash_location
   WHERE id = p_location AND is_active;
  IF v_kind IS NULL THEN RAISE EXCEPTION 'lokasi tujuan tak ditemukan / nonaktif'; END IF;
  IF v_scope IS DISTINCT FROM 'pusat' THEN
    RAISE EXCEPTION 'setoran harus ke rekening/kas pusat, bukan kas kecil outlet';
  END IF;

  v_cat := CASE WHEN v_kind = 'bank' THEN 'Setoran Bank' ELSE 'Setoran Tunai' END;

  -- Langsung 'reconciled' (tanpa approval) agar saldo terupdate seketika,
  -- sama seperti perilaku sebelumnya.
  INSERT INTO public.cash_transaction (
    cash_location_id, direction, amount, category,
    source_type, outlet_id, note, proof_url, status, sales_date,
    created_by, approved_by, approved_at, reconciled_by, reconciled_at
  ) VALUES (
    p_location, 'in', p_amount, v_cat,
    'cash_deposit', p_outlet, p_note, p_proof_url, 'reconciled', p_sales_date,
    auth.uid(), auth.uid(), now(), auth.uid(), now()
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_cash_deposit(uuid, numeric, uuid, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_cash_deposit(uuid, numeric, uuid, text, text, date) TO authenticated, service_role;
