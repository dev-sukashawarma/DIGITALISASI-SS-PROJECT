-- supabase/verifikasi/master_bahan/t12_purchasing_tambah.sql — harapan: NOTICE 'HASIL T12: LULUS'
-- Migration 20261106130000: purchasing boleh MEMBUAT bahan baru, tidak boleh mengubah,
-- menonaktifkan, atau mengelola SKU bahan. Crew tetap ditolak semuanya.
-- Sebelum migration, kasus (a) harus GAGAL (kontrol negatif).
BEGIN;
DO $$
DECLARE v_admin uuid; v_purch uuid; v_crew uuid; v_id uuid; v_id_admin uuid; v_ok boolean;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;
  SELECT id INTO v_purch FROM outlet_staff WHERE role='purchasing' AND status='active' LIMIT 1;
  SELECT id INTO v_crew  FROM outlet_staff WHERE role='crew' AND status='active' LIMIT 1;
  IF v_admin IS NULL OR v_purch IS NULL OR v_crew IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture'; END IF;

  -- (a) purchasing membuat bahan tiga tingkat; faktor dihitung server, audit tercatat
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_purch, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_id := public.simpan_bahan_baku(NULL, jsonb_build_object(
    'nama','UJI T12 BAHAN PURCHASING','kategori','UJI','satuan','Dus','satuan_tengah','Pack','faktor_tengah',10,
    'satuan_kecil','Pcs','isi_kecil_per_tengah',50), 'uji t12 purchasing buat');
  RESET ROLE;
  IF (SELECT faktor_tampilan FROM bahan_baku WHERE id = v_id) <> 500 THEN
    RAISE EXCEPTION 'GAGAL (a): faktor salah';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM master_bahan_audit WHERE baris_id = v_id AND aksi = 'INSERT' AND alasan = 'uji t12 purchasing buat') THEN
    RAISE EXCEPTION 'GAGAL (a): audit INSERT tak tercatat';
  END IF;

  -- (b) purchasing mengubah bahan (termasuk yang baru ia buat) ditolak
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN
    PERFORM public.simpan_bahan_baku(v_id, jsonb_build_object('nama','UJI T12 DIUBAH'), NULL);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (b): purchasing bisa mengubah bahan'; END IF;

  -- (c) purchasing menonaktifkan bahan ditolak
  v_ok := false;
  BEGIN
    PERFORM public.nonaktifkan_bahan_baku(v_id, 'uji');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): purchasing bisa menonaktifkan bahan'; END IF;

  -- (d) purchasing membuat SKU ditolak
  v_ok := false;
  BEGIN
    PERFORM public.simpan_sku(NULL, v_id, jsonb_build_object('nama_kemasan','UJI','qty_isi',1));
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (d): purchasing bisa membuat SKU'; END IF;
  RESET ROLE;

  -- (e) crew membuat bahan ditolak
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN
    PERFORM public.simpan_bahan_baku(NULL, jsonb_build_object('nama','UJI T12 CREW','kategori','UJI','satuan','Pcs','isi_kecil_per_tengah',1), NULL);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (e): crew bisa membuat bahan'; END IF;
  RESET ROLE;

  -- (f) admin tetap bisa membuat dan mengubah
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_id_admin := public.simpan_bahan_baku(NULL, jsonb_build_object('nama','UJI T12 ADMIN','kategori','UJI','satuan','Pcs','isi_kecil_per_tengah',1), 'uji');
  PERFORM public.simpan_bahan_baku(v_id, jsonb_build_object('default_reorder_point', 3), 'uji');
  RESET ROLE;
  IF v_id_admin IS NULL OR (SELECT default_reorder_point FROM bahan_baku WHERE id = v_id) <> 3 THEN
    RAISE EXCEPTION 'GAGAL (f): admin tak bisa membuat/mengubah';
  END IF;

  RAISE NOTICE 'HASIL T12: LULUS';
END $$;
ROLLBACK;
