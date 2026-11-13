-- t1 — status_persiapan_outlet (migration 20261113110000)
-- Seluruhnya di dalam BEGIN … ROLLBACK. Bertindak sebagai Admin Dev lewat klaim JWT.
-- Sebelum migration: gagal (fungsi tidak ada). Sesudah: NOTICE 't1: LULUS'.
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"6440a568-d9f3-45d3-b7d7-16e4b3166ab2","role":"authenticated"}', true);

DO $$
DECLARE
  v_outlet  uuid;
  v_int     uuid;
  v_am      uuid;
  v_crew    uuid;
  v_crew_lama uuid;
  r         jsonb;
  ok        boolean;
  function_langkah_selesai text;
BEGIN
  SELECT id INTO v_am   FROM public.outlet_staff WHERE role = 'area_manager' AND status = 'active' LIMIT 1;
  SELECT id, outlet_id INTO v_crew, v_crew_lama FROM public.outlet_staff WHERE role = 'crew' AND status = 'active' LIMIT 1;

  INSERT INTO public.outlets (name, slug, type, status, address)
  VALUES ('UJI WIZARD T1', 'uji-wizard-t1', 'mitra', 'pending', NULL)
  RETURNING id INTO v_outlet;

  -- 1. Outlet kosong → belum siap; data_outlet belum selesai
  r := public.status_persiapan_outlet(v_outlet);
  IF (r->>'siap_go_live')::boolean THEN RAISE EXCEPTION 'ASERSI GAGAL 1: outlet kosong dinyatakan siap'; END IF;
  SELECT (e->>'selesai')::boolean INTO ok FROM jsonb_array_elements(r->'langkah') e WHERE e->>'kunci' = 'data_outlet';
  IF ok THEN RAISE EXCEPTION 'ASERSI GAGAL 1b: data_outlet selesai padahal alamat kosong'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'langkah') e WHERE e->>'kunci' = 'mitra') THEN
    RAISE EXCEPTION 'ASERSI GAGAL 1c: outlet mitra tidak punya langkah mitra';
  END IF;

  -- 2. Lengkapi semua langkah wajib (tanpa leader)
  UPDATE public.outlets SET address = 'Jl. Uji 1', lat = -6.6, lng = 106.8,
         tanggal_grand_opening = current_date + 3 WHERE id = v_outlet;
  INSERT INTO public.am_outlet_assignments (staff_id, outlet_id, effective_from, reason)
  VALUES (v_am, v_outlet, current_date - 1, 'uji t1');
  UPDATE public.outlet_staff SET outlet_id = v_outlet WHERE id = v_crew;
  INSERT INTO public.surat_jalan (outlet_id, status) VALUES (v_outlet, 'diterima_lengkap');
  INSERT INTO public.opname (outlet_id, status, finalized_at) VALUES (v_outlet, 'finalized', now());
  INSERT INTO public.mitra_investments (outlet_id, nilai_investasi, tanggal_mulai) VALUES (v_outlet, 1, current_date);
  UPDATE public.mitra_profiles SET outlet_ids = outlet_ids || v_outlet
  WHERE id = (SELECT id FROM public.mitra_profiles LIMIT 1);

  r := public.status_persiapan_outlet(v_outlet);
  IF NOT (r->>'siap_go_live')::boolean THEN
    SELECT string_agg(e->>'kunci', ', ') INTO function_langkah_selesai
    FROM jsonb_array_elements(r->'langkah') e WHERE (e->>'wajib')::boolean AND NOT (e->>'selesai')::boolean;
    RAISE EXCEPTION 'ASERSI GAGAL 2: belum siap, kurang: %', function_langkah_selesai;
  END IF;
  SELECT (e->>'selesai')::boolean INTO ok FROM jsonb_array_elements(r->'langkah') e WHERE e->>'kunci' = 'leader';
  IF ok THEN RAISE EXCEPTION 'ASERSI GAGAL 2b: leader dianggap selesai'; END IF;

  -- 3. Tanggal grand opening dikosongkan → tidak siap
  UPDATE public.outlets SET tanggal_grand_opening = NULL WHERE id = v_outlet;
  IF (public.status_persiapan_outlet(v_outlet)->>'siap_go_live')::boolean THEN
    RAISE EXCEPTION 'ASERSI GAGAL 3: siap tanpa tanggal grand opening';
  END IF;
  UPDATE public.outlets SET tanggal_grand_opening = current_date + 3 WHERE id = v_outlet;

  -- 4. Crew dinonaktifkan → tidak siap
  UPDATE public.outlet_staff SET status = 'inactive' WHERE id = v_crew;
  IF (public.status_persiapan_outlet(v_outlet)->>'siap_go_live')::boolean THEN
    RAISE EXCEPTION 'ASERSI GAGAL 4: siap tanpa crew aktif';
  END IF;
  UPDATE public.outlet_staff SET status = 'active' WHERE id = v_crew;

  -- 5. Outlet aktif → siap_go_live false
  -- Simulasikan Go-Live (penjaga trg_zz_outlets_jaga_persiapan butuh saklar ini).
  PERFORM set_config('app.pembukaan_outlet', 'on', true);
  UPDATE public.outlets SET status = 'active' WHERE id = v_outlet;
  PERFORM set_config('app.pembukaan_outlet', '', true);
  IF (public.status_persiapan_outlet(v_outlet)->>'siap_go_live')::boolean THEN
    RAISE EXCEPTION 'ASERSI GAGAL 5: outlet aktif dinyatakan siap go-live';
  END IF;

  -- 6. Outlet internal tidak punya langkah mitra / masa_rab
  SELECT id INTO v_int FROM public.outlets WHERE type = 'internal' AND is_active LIMIT 1;
  r := public.status_persiapan_outlet(v_int);
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(r->'langkah') e WHERE e->>'kunci' IN ('mitra','masa_rab')) THEN
    RAISE EXCEPTION 'ASERSI GAGAL 6: outlet internal punya langkah mitra';
  END IF;

  -- 7. Role crew → 42501
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.status_persiapan_outlet(v_outlet);
    RAISE EXCEPTION 'ASERSI GAGAL 7: crew bisa membaca status persiapan';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  RAISE NOTICE 't1: LULUS';
END $$;
SELECT 't1 lulus' AS hasil;
ROLLBACK;
