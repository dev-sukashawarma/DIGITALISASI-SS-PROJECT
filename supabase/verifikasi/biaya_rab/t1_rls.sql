-- Uji RLS biaya_rab_outlet (jalankan sebagai satu transaksi; selalu ROLLBACK).
-- Lulus = admin_finance membaca 1 baris, mitra 0 baris, mitra tak bisa INSERT.
BEGIN;
INSERT INTO public.biaya_rab_outlet (marcom_expense_id, outlet_id, outlet_nama, kategori, kategori_label, jumlah, keterangan, tanggal)
VALUES (-999001, NULL, 'UJI', 'LAINNYA', 'Uji', 1000, 'uji rls', current_date);

DO $$
DECLARE n_fin int; n_mitra int; ditolak boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',
    (SELECT id FROM outlet_staff WHERE role='admin_finance' AND status='active' LIMIT 1), 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n_fin FROM public.biaya_rab_outlet WHERE marcom_expense_id = -999001;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',
    (SELECT id FROM outlet_staff WHERE role='mitra' AND status='active' LIMIT 1), 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n_mitra FROM public.biaya_rab_outlet WHERE marcom_expense_id = -999001;
  BEGIN
    INSERT INTO public.biaya_rab_outlet (marcom_expense_id, outlet_nama, kategori, kategori_label, jumlah, keterangan, tanggal)
    VALUES (-999002, 'x', 'x', 'x', 1, 'x', current_date);
  EXCEPTION WHEN insufficient_privilege THEN ditolak := true;
  END;
  RESET ROLE;

  IF n_fin <> 1 THEN RAISE EXCEPTION 'ASERSI GAGAL: admin_finance baca % baris (harus 1)', n_fin; END IF;
  IF n_mitra <> 0 THEN RAISE EXCEPTION 'ASERSI GAGAL: mitra baca % baris (harus 0)', n_mitra; END IF;
  IF NOT ditolak THEN RAISE EXCEPTION 'ASERSI GAGAL: mitra bisa INSERT'; END IF;
  RAISE NOTICE 'LULUS: fin=%, mitra=%, insert mitra ditolak', n_fin, n_mitra;
END $$;
ROLLBACK;
