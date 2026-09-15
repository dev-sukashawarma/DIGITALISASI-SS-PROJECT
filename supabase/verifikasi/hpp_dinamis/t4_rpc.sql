-- supabase/verifikasi/hpp_dinamis/t4_rpc.sql
-- Harapan: "HASIL T4: LULUS ..."
BEGIN;
DO $$
DECLARE v_empang uuid; v_tes uuid; v_kitchen uuid; v_crew uuid;
        v_n int; v_nilai numeric; v_qty numeric; v_ok boolean; r record;
        v_teoritis numeric; v_periode numeric;
BEGIN
  SELECT id INTO v_empang FROM outlets WHERE name='SUKA SHAWARMA EMPANG';
  SELECT id INTO v_tes FROM outlets WHERE type='test' LIMIT 1;
  SELECT id INTO v_kitchen FROM outlet_staff WHERE role='kitchen' AND status='active' LIMIT 1;
  SELECT id INTO v_crew FROM outlet_staff WHERE role='crew' AND status='active' LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_kitchen,'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- (a) bahan Empang 1-14 Sep: ada baris, nilai > 0, porsi kiriman > 0
  SELECT count(*), SUM(nilai), SUM(nilai_kiriman) INTO v_n, v_nilai, v_qty
  FROM get_hpp_dinamis_bahan(v_empang, '2026-09-01', '2026-09-14');
  IF v_n < 10 OR v_nilai <= 0 OR COALESCE(v_qty,0) <= 0 THEN
    RAISE EXCEPTION 'GAGAL (a): n=% nilai=% kiriman=%', v_n, v_nilai, v_qty; END IF;

  -- (b) porsi sumber menjumlah ke nilai (tidak ada sumber di luar 5 kategori)
  SELECT SUM(nilai) - SUM(COALESCE(nilai_kiriman,0)+COALESCE(nilai_drop_ship,0)+COALESCE(nilai_master_historis,0)
                        +COALESCE(nilai_master_sekarang,0)+COALESCE(nilai_tidak_ada,0)) INTO v_nilai
  FROM get_hpp_dinamis_bahan(v_empang, '2026-09-01', '2026-09-14');
  IF abs(v_nilai) > 0.01 THEN RAISE EXCEPTION 'GAGAL (b): porsi sumber tidak menjumlah, selisih %', v_nilai; END IF;

  -- (c) menu Empang: menu ber-resep punya hpp_teoritis_total > 0; tanpa resep NULL
  SELECT count(*) INTO v_n FROM get_hpp_dinamis_menu(v_empang, '2026-09-01', '2026-09-14')
  WHERE punya_resep AND COALESCE(hpp_teoritis_total,0) <= 0;
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (c): % menu ber-resep tanpa HPP teoritis', v_n; END IF;
  SELECT count(*) INTO v_n FROM get_hpp_dinamis_menu(v_empang, '2026-09-01', '2026-09-14')
  WHERE NOT punya_resep AND hpp_teoritis_total IS NOT NULL;
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (c): menu tanpa resep dapat HPP teoritis'; END IF;

  -- (d) sanity vs get_hpp_periode (harga master hari ini): teoritis dinamis
  --     harus dalam ±40% dari HPP periode (bukan 10x / 0.1x = salah skala)
  SELECT SUM(hpp_teoritis_total) INTO v_teoritis FROM get_hpp_dinamis_menu(v_empang, '2026-09-01', '2026-09-14');
  SELECT hpp INTO v_periode FROM get_hpp_periode('2026-09-01', '2026-09-14') WHERE outlet_id = v_empang;
  IF v_periode > 0 AND (v_teoritis / v_periode < 0.6 OR v_teoritis / v_periode > 1.4) THEN
    RAISE EXCEPTION 'GAGAL (d): teoritis dinamis % vs periode % — cek skala', v_teoritis, v_periode; END IF;

  -- (e) outlet tes ditolak
  v_ok := false;
  BEGIN PERFORM get_hpp_dinamis_bahan(v_tes, '2026-09-01', '2026-09-14');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (e): outlet tes ikut terhitung'; END IF;

  -- (f) rentang > 92 hari ditolak
  v_ok := false;
  BEGIN PERFORM get_hpp_dinamis_menu(v_empang, '2026-01-01', '2026-09-14');
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f): rentang panjang lolos'; END IF;
  EXECUTE 'RESET ROLE';

  -- (g) crew ditolak
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew,'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_ok := false;
  BEGIN PERFORM get_hpp_dinamis_bahan(v_empang, '2026-09-01', '2026-09-14');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (g): crew bisa baca HPP dinamis'; END IF;
  EXECUTE 'RESET ROLE';

  -- (h) kontrol negatif
  v_ok := false;
  BEGIN IF v_teoritis > 0 THEN RAISE EXCEPTION 'KONTROL'; END IF;
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (h)'; END IF;

  RAISE EXCEPTION 'HASIL T4: LULUS (bahan, porsi sumber, menu, sanity skala, outlet tes, rentang, crew, kontrol negatif)';
END $$;
ROLLBACK;
