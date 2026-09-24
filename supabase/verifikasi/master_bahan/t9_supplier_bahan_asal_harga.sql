-- supabase/verifikasi/master_bahan/t9_supplier_bahan_asal_harga.sql — harapan: tanpa error
BEGIN;
DO $$
DECLARE v_purch uuid; v_sup uuid; v_b1 uuid; v_b2 uuid; v_ok boolean; v_n int;
BEGIN
  SELECT id INTO v_purch FROM outlet_staff WHERE role='purchasing' AND status='active' LIMIT 1;
  SELECT id INTO v_b1 FROM bahan_baku WHERE nama='SAPI';
  SELECT id INTO v_b2 FROM bahan_baku WHERE nama='AYAM';
  IF v_purch IS NULL OR v_b1 IS NULL OR v_b2 IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_purch, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- (a) bahan_baku_ids tersimpan saat membuat
  v_sup := public.simpan_supplier(NULL, jsonb_build_object('nama','UJI T9 VENDOR','bahan_baku_ids', jsonb_build_array(v_b1, v_b2)), 'uji t9');
  IF (SELECT bahan_baku_ids FROM supplier WHERE id = v_sup) IS DISTINCT FROM ARRAY[v_b1, v_b2] THEN
    RAISE EXCEPTION 'GAGAL (a): bahan_baku_ids tak tersimpan';
  END IF;

  -- (b) update mengganti daftar; kunci lain tak tersentuh
  PERFORM public.simpan_supplier(v_sup, jsonb_build_object('bahan_baku_ids', jsonb_build_array(v_b2)), 'uji t9 ubah');
  IF (SELECT bahan_baku_ids FROM supplier WHERE id = v_sup) IS DISTINCT FROM ARRAY[v_b2]
     OR (SELECT nama FROM supplier WHERE id = v_sup) <> 'UJI T9 VENDOR' THEN
    RAISE EXCEPTION 'GAGAL (b): update bahan_baku_ids salah';
  END IF;

  -- (c) id yang tidak ada ditolak 22023
  v_ok := false;
  BEGIN
    PERFORM public.simpan_supplier(v_sup, jsonb_build_object('bahan_baku_ids', jsonb_build_array(gen_random_uuid())), 'uji');
  EXCEPTION WHEN invalid_parameter_value THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): id bahan liar diterima'; END IF;

  -- (d) bukan array ditolak 22023
  v_ok := false;
  BEGIN
    PERFORM public.simpan_supplier(v_sup, jsonb_build_object('bahan_baku_ids', 'x'), 'uji');
  EXCEPTION WHEN invalid_parameter_value THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (d): bahan_baku_ids bukan array diterima'; END IF;

  -- (e) view asal harga: satu baris per bahan, sama dengan riwayat terbaru
  SELECT count(*) - count(DISTINCT bahan_baku_id) INTO v_n FROM bahan_baku_harga_asal;
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (e): view asal harga punya baris kembar'; END IF;
  IF EXISTS (SELECT 1 FROM bahan_baku_harga_asal a
              WHERE a.changed_at <> (SELECT max(h.changed_at) FROM bahan_baku_harga_history h WHERE h.bahan_baku_id = a.bahan_baku_id)) THEN
    RAISE EXCEPTION 'GAGAL (e): view asal harga bukan riwayat terbaru';
  END IF;
  RAISE NOTICE 'HASIL T9: LULUS';
END $$;
ROLLBACK;
