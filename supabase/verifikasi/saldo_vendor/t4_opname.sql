-- supabase/verifikasi/saldo_vendor/t4_opname.sql — harapan "HASIL T4: LULUS"
BEGIN;
DO $$
DECLARE v_k uuid; v_sapi uuid; v_dj uuid; v_az uuid; v_op uuid; v_ok boolean; v_sisa numeric; v_f numeric;
BEGIN
  SELECT id INTO v_k FROM outlet_staff WHERE role='kitchen' AND status='active' AND outlet_id = public.gudang_pusat_id() LIMIT 1;
  SELECT id INTO v_sapi FROM bahan_baku WHERE nama='SAPI';
  SELECT public.vendor_induk(id) INTO v_dj FROM supplier WHERE nama ILIKE 'Djafafood%';
  SELECT id INTO v_az FROM supplier WHERE nama='Lettuce (Pak Aziz) - Tempo 10';
  IF v_k IS NULL THEN RAISE EXCEPTION 'GAGAL: tak ada kitchen ber-outlet Gudang Pusat'; END IF;
  v_f := public.to_ledger_scale(public.gudang_pusat_id(), v_sapi, 1);
  INSERT INTO opname (outlet_id, tanggal, tipe, status, created_by)
  VALUES (public.gudang_pusat_id(), current_date, 'ad_hoc', 'draft', v_k) RETURNING id INTO v_op;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_k,'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  -- (a) hanya satu vendor SAPI diisi → ditolak
  v_ok := false;
  BEGIN PERFORM public.simpan_hitung_vendor(v_op, jsonb_build_array(
      jsonb_build_object('bahan_baku_id', v_sapi, 'vendor_id', v_dj, 'qty_besar', 12)));
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (a): sub-baris sebagian lolos'; END IF;
  -- (b) lengkap → tersimpan
  PERFORM public.simpan_hitung_vendor(v_op, jsonb_build_array(
      jsonb_build_object('bahan_baku_id', v_sapi, 'vendor_id', v_dj, 'qty_besar', 12),
      jsonb_build_object('bahan_baku_id', v_sapi, 'vendor_id', v_az, 'qty_besar', 9)));
  EXECUTE 'RESET ROLE';

  -- (c) finalisasi (qty_fisik item = 21 Blok dalam skala gudang) → sisa Djafafood 12, Pak Aziz 9, SAPI aktif
  INSERT INTO opname_item (opname_id, bahan_baku_id, qty_fisik, qty_system)
  VALUES (v_op, v_sapi, 21 * v_f, 21 * v_f);
  UPDATE opname SET status = 'finalized' WHERE id = v_op;
  v_sisa := public.sisa_vendor_gudang(v_sapi, v_dj) / v_f;
  IF v_sisa <> 12 THEN RAISE EXCEPTION 'GAGAL (c): sisa Djafafood %', v_sisa; END IF;
  IF NOT public.bahan_vendor_aktif(v_sapi) THEN RAISE EXCEPTION 'GAGAL (c): SAPI belum aktif'; END IF;

  -- (d) idempoten: memicu ulang (status bolak-balik) tidak menggandakan
  UPDATE opname SET status = 'draft' WHERE id = v_op;
  UPDATE opname SET status = 'finalized' WHERE id = v_op;
  v_sisa := public.sisa_vendor_gudang(v_sapi, v_dj) / v_f;
  IF v_sisa <> 12 THEN RAISE EXCEPTION 'GAGAL (d): sisa berubah jadi %', v_sisa; END IF;

  RAISE EXCEPTION 'HASIL T4: LULUS (sebagian ditolak, simpan, final → hitung_fisik, aktif, idempoten)';
END $$;
ROLLBACK;
