-- t7 — stok awal & opname pertama = Peringatan (migration 20261113170000).
-- Seluruhnya BEGIN … ROLLBACK. Sukses = baris 't7 lulus'.
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"6440a568-d9f3-45d3-b7d7-16e4b3166ab2","role":"authenticated"}', true);
DO $$
DECLARE v_am uuid; v_crew uuid; v_o uuid; r jsonb;
  v_hari date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  SELECT id INTO v_am FROM public.outlet_staff WHERE role = 'area_manager' AND status = 'active' LIMIT 1;
  SELECT id INTO v_crew FROM public.outlet_staff WHERE role = 'crew' AND status = 'active' LIMIT 1;
  v_o := public.buat_outlet_persiapan(jsonb_build_object('jenis','internal','nama','UJI WIZARD T7',
    'am_staff_id',v_am,'alamat','Jl. Uji 7','lat',-6.6,'lng',106.8,'tanggal_grand_opening',v_hari));
  UPDATE public.outlet_staff SET outlet_id = v_o WHERE id = v_crew;
  r := public.status_persiapan_outlet(v_o);
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(r->'langkah') e
             WHERE e->>'kunci' IN ('stok_awal','opname_pertama') AND (e->>'wajib')::boolean) THEN
    RAISE EXCEPTION 'ASERSI GAGAL: stok awal/opname masih wajib';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(r->'langkah') e WHERE e->>'kunci' IN ('stok_awal','opname_pertama')) <> 2 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: langkah stok awal/opname hilang dari papan';
  END IF;
  IF NOT (r->>'siap_go_live')::boolean THEN
    RAISE EXCEPTION 'ASERSI GAGAL: belum siap Go-Live tanpa SJ & opname: %', r->'langkah';
  END IF;
  r := public.go_live_outlet(v_o, 'UJI WIZARD T7', v_hari);
  IF (r->>'paksa')::boolean THEN RAISE EXCEPTION 'ASERSI GAGAL: Go-Live tercatat paksa'; END IF;
END $$;
SELECT 't7 lulus' AS hasil;
ROLLBACK;
