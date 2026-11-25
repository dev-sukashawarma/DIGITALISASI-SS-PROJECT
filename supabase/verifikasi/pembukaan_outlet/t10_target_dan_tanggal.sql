-- t10 — bug hunt 2026-11-25 lanjutan (migration 20261125190000, 20261125191000).
-- (a) snapshot target harian tidak membuat baris untuk outlet Persiapan
-- (b) Go-Live dengan tanggal di masa depan ditolak; hari ini tetap boleh
-- Seluruhnya BEGIN … ROLLBACK, sebagai Admin Dev. Sukses = baris 't10 lulus'.
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"6440a568-d9f3-45d3-b7d7-16e4b3166ab2","role":"authenticated"}', true);
DO $$
DECLARE v_o uuid; v_am uuid; v_crew uuid; v_err text;
  v_hari date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  -- (a)
  v_o := public.buat_outlet_persiapan(jsonb_build_object('jenis','internal','nama','UJI WIZARD T10A'));
  PERFORM public.snapshot_daily_targets(v_hari);
  IF EXISTS (SELECT 1 FROM public.historical_daily_targets WHERE outlet_id = v_o) THEN
    RAISE EXCEPTION 'ASERSI GAGAL a: target harian dibuat untuk outlet Persiapan';
  END IF;
  IF EXISTS (SELECT 1 FROM public.historical_daily_targets h JOIN public.outlets o ON o.id = h.outlet_id WHERE o.status = 'pending') THEN
    RAISE EXCEPTION 'ASERSI GAGAL a: masih ada baris target untuk outlet Persiapan';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.historical_daily_targets WHERE record_date = v_hari) THEN
    RAISE EXCEPTION 'ASERSI GAGAL a: snapshot tidak membuat baris untuk outlet aktif';
  END IF;

  -- (b)
  SELECT id INTO v_am FROM public.outlet_staff WHERE role = 'area_manager' AND status = 'active' LIMIT 1;
  SELECT id INTO v_crew FROM public.outlet_staff WHERE role = 'crew' AND status = 'active' LIMIT 1;
  v_o := public.buat_outlet_persiapan(jsonb_build_object('jenis','internal','nama','UJI WIZARD T10B',
    'am_staff_id',v_am,'alamat','Jl. Uji 10','lat',-6.6,'lng',106.8,'tanggal_grand_opening',v_hari + 3));
  UPDATE public.outlet_staff SET outlet_id = v_o WHERE id = v_crew;
  BEGIN
    PERFORM public.go_live_outlet(v_o, 'UJI WIZARD T10B', v_hari + 3);
    RAISE EXCEPTION 'ASERSI GAGAL b: Go-Live tanggal masa depan diterima';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err LIKE 'ASERSI GAGAL%' THEN RAISE; END IF;
    IF v_err NOT LIKE '%paling jauh 7 hari ke belakang%' THEN RAISE EXCEPTION 'ASERSI GAGAL b: pesan %', v_err; END IF;
  END;
  PERFORM public.go_live_outlet(v_o, 'UJI WIZARD T10B', v_hari);
  IF (SELECT status FROM public.outlets WHERE id = v_o) <> 'active' THEN RAISE EXCEPTION 'ASERSI GAGAL b: Go-Live hari ini gagal'; END IF;
END $$;
SELECT 't10 lulus' AS hasil;
ROLLBACK;
