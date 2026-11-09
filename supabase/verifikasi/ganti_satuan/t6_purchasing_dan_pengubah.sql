-- supabase/verifikasi/ganti_satuan/t6_purchasing_dan_pengubah.sql — harapan: 'HASIL T6: LULUS' (P0001 lewat MCP)
-- (a) purchasing boleh pratinjau & menjalankan Ganti Satuan (lingkup 'satuan', permintaan owner 2026-11-09)
-- (b) purchasing tetap TIDAK boleh mengubah data bahan lain (lingkup 'data' tetap admin/owner/developer)
-- (c) crew tetap ditolak
-- (d) pengubah_terakhir_bahan(): nama pelaku perubahan terakhir per bahan; crew ditolak
BEGIN;
DO $$
DECLARE
  c_kg constant jsonb := '{"satuan":"Kg","satuan_kecil":"gram","isi_kecil_per_tengah":1000,"satuan_po":"Kg","satuan_distribusi":"Kg"}';
  v_purch uuid; v_purch_nama text; v_crew uuid; v_b uuid; v_ok boolean; v_r record;
BEGIN
  SELECT id, name INTO v_purch, v_purch_nama FROM outlet_staff WHERE role='purchasing' AND status='active' ORDER BY name LIMIT 1;
  SELECT id INTO v_crew FROM outlet_staff WHERE role='crew' AND status='active' LIMIT 1;
  IF v_purch IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture purchasing'; END IF;
  INSERT INTO bahan_baku (nama, kategori, satuan, satuan_kecil, faktor_tampilan, satuan_po, satuan_distribusi, is_active)
  VALUES ('UJI T6 SATUAN','UJI','Dus','Pcs',10,'Dus','Dus',true) RETURNING id INTO v_b;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_purch, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  -- (a)
  PERFORM public.pratinjau_ganti_satuan(v_b, c_kg, 100);
  PERFORM public.ganti_satuan_bahan(v_b, c_kg, 100, 'uji t6 purchasing');
  -- (b)
  v_ok := false;
  BEGIN PERFORM public.simpan_bahan_baku(v_b, jsonb_build_object('nama','UJI T6 DIUBAH'), 'uji');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (b): purchasing bisa mengubah data bahan'; END IF;
  -- (d) pengubah terakhir = purchasing ini
  SELECT * INTO v_r FROM public.pengubah_terakhir_bahan() WHERE bahan_baku_id = v_b;
  RESET ROLE;
  IF (SELECT satuan FROM bahan_baku WHERE id = v_b) <> 'Kg' THEN RAISE EXCEPTION 'GAGAL (a): satuan tak berganti'; END IF;
  IF v_r.bahan_baku_id IS NULL OR v_r.diubah_oleh IS DISTINCT FROM v_purch OR v_r.nama_pengubah IS DISTINCT FROM v_purch_nama
     OR v_r.diubah_at IS NULL THEN
    RAISE EXCEPTION 'GAGAL (d): pengubah %', row_to_json(v_r);
  END IF;

  -- (c) crew ditolak keduanya
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN PERFORM public.pratinjau_ganti_satuan(v_b, c_kg, 1);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): crew bisa pratinjau'; END IF;
  v_ok := false;
  BEGIN PERFORM * FROM public.pengubah_terakhir_bahan();
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): crew bisa membaca pengubah'; END IF;
  RESET ROLE;

  RAISE EXCEPTION 'HASIL T6: LULUS';
END $$;
ROLLBACK;
