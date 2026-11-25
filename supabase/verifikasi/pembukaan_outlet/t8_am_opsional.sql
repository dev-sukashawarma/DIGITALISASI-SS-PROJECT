-- t8 — AM boleh kosong saat outlet dibuat (migration 20261125150000).
-- Seluruhnya BEGIN … ROLLBACK, sebagai Admin Dev. Sukses = baris 't8 lulus'.
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"6440a568-d9f3-45d3-b7d7-16e4b3166ab2","role":"authenticated"}', true);
DO $$
DECLARE v_o uuid; v_crew uuid; v_err text; r jsonb;
BEGIN
  -- (a) tanpa AM: outlet tetap tercipta berstatus Persiapan, tanpa penugasan AM
  v_o := public.buat_outlet_persiapan(jsonb_build_object('jenis','internal','nama','UJI WIZARD T8'));
  IF (SELECT status FROM public.outlets WHERE id = v_o) <> 'pending' THEN RAISE EXCEPTION 'ASERSI GAGAL a: bukan pending'; END IF;
  IF EXISTS (SELECT 1 FROM public.am_outlet_assignments WHERE outlet_id = v_o) THEN RAISE EXCEPTION 'ASERSI GAGAL a: ada penugasan AM'; END IF;
  IF EXISTS (SELECT 1 FROM public.staff_outlets WHERE outlet_id = v_o) THEN RAISE EXCEPTION 'ASERSI GAGAL a: ada staff_outlets'; END IF;

  -- (b) papan: langkah AM tetap wajib dan belum selesai
  r := public.status_persiapan_outlet(v_o);
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'langkah') e
                 WHERE e->>'kunci' = 'am' AND (e->>'wajib')::boolean AND NOT (e->>'selesai')::boolean) THEN
    RAISE EXCEPTION 'ASERSI GAGAL b: langkah AM bukan wajib-belum-selesai';
  END IF;

  -- (c) AM yang bukan Area Manager aktif tetap ditolak
  SELECT id INTO v_crew FROM public.outlet_staff WHERE role = 'crew' AND status = 'active' LIMIT 1;
  BEGIN
    PERFORM public.buat_outlet_persiapan(jsonb_build_object('jenis','internal','nama','UJI WIZARD T8B','am_staff_id',v_crew));
    RAISE EXCEPTION 'ASERSI GAGAL c: crew diterima sebagai AM';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err LIKE 'ASERSI GAGAL%' THEN RAISE; END IF;
    IF v_err NOT LIKE '%bukan staf Area Manager%' THEN RAISE EXCEPTION 'ASERSI GAGAL c: pesan %', v_err; END IF;
  END;
END $$;
SELECT 't8 lulus' AS hasil;
ROLLBACK;
