-- supabase/verifikasi/saldo_vendor/t1_skema.sql
-- Harapan: "HASIL T1: LULUS ..."
BEGIN;
DO $$
DECLARE v_kitchen uuid; v_crew uuid; v_sapi uuid; v_ayam uuid; v_dj uuid; v_aziz10 uuid; v_aziz15 uuid;
        v_n int; v_ok boolean; r record;
BEGIN
  SELECT id INTO v_kitchen FROM outlet_staff WHERE role='kitchen' AND status='active' LIMIT 1;
  SELECT id INTO v_crew    FROM outlet_staff WHERE role='crew' AND status='active' LIMIT 1;
  SELECT id INTO v_sapi FROM bahan_baku WHERE nama='SAPI';
  SELECT id INTO v_ayam FROM bahan_baku WHERE nama='AYAM';
  SELECT id INTO v_dj FROM supplier WHERE nama ILIKE 'Djafafood%';
  SELECT id INTO v_aziz10 FROM supplier WHERE nama='Lettuce (Pak Aziz) - Tempo 10';
  SELECT id INTO v_aziz15 FROM supplier WHERE nama='Lettuce (Pak Aziz) - Tempo 15';
  IF v_kitchen IS NULL OR v_crew IS NULL OR v_sapi IS NULL OR v_dj IS NULL OR v_aziz10 IS NULL THEN
    RAISE EXCEPTION 'GAGAL: fixture tak ketemu'; END IF;

  -- (a) grup Pak Aziz
  IF public.vendor_induk(v_aziz15) <> v_aziz10 THEN RAISE EXCEPTION 'GAGAL (a): Tempo 15 bukan anak Tempo 10'; END IF;
  -- (b) SAPI multi-vendor = Djafafood + Pak Aziz (tepat 2 induk)
  SELECT count(*) INTO v_n FROM public.vendor_bahan(v_sapi);
  IF v_n <> 2 OR NOT public.bahan_multi_vendor(v_sapi) THEN RAISE EXCEPTION 'GAGAL (b): SAPI vendor induk = %', v_n; END IF;
  -- (c) AYAM tak lagi multi (Dunia Plastik dinonaktifkan)
  IF public.bahan_multi_vendor(v_ayam) THEN RAISE EXCEPTION 'GAGAL (c): AYAM masih multi-vendor'; END IF;
  -- (d) belum aktif sebelum hitung fisik
  IF public.bahan_vendor_aktif(v_sapi) THEN RAISE EXCEPTION 'GAGAL (d): SAPI sudah aktif tanpa hitung fisik'; END IF;

  -- (e) kitchen: RPC saldo memuat 2 baris SAPI, sisa 0, multi=true
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_kitchen,'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_n FROM public.saldo_vendor_gudang(ARRAY[v_sapi]) s WHERE s.multi AND s.sisa = 0 AND NOT s.aktif;
  IF v_n <> 2 THEN RAISE EXCEPTION 'GAGAL (e): saldo SAPI baris=%', v_n; END IF;
  -- (f) koreksi +5 Blok Djafafood → sisa 5
  PERFORM public.koreksi_saldo_vendor(v_sapi, v_dj, 5, 'uji');
  SELECT sisa INTO r FROM public.saldo_vendor_gudang(ARRAY[v_sapi]) s WHERE s.vendor_id = v_dj;
  IF r.sisa <> 5 THEN RAISE EXCEPTION 'GAGAL (f): sisa % bukan 5', r.sisa; END IF;
  -- (g) koreksi tanpa catatan ditolak
  v_ok := false;
  BEGIN PERFORM public.koreksi_saldo_vendor(v_sapi, v_dj, 1, ' '); EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (g): koreksi tanpa catatan lolos'; END IF;
  -- (h) tulis langsung ditolak
  v_ok := false;
  BEGIN INSERT INTO stok_vendor_gudang_mutasi (bahan_baku_id, vendor_id, qty, sumber) VALUES (v_sapi, v_dj, 1, 'koreksi');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (h): INSERT langsung lolos'; END IF;
  EXECUTE 'RESET ROLE';

  -- (i) crew ditolak RPC saldo
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew,'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_ok := false;
  BEGIN PERFORM public.saldo_vendor_gudang(ARRAY[v_sapi]); EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (i): crew bisa baca saldo vendor'; END IF;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'HASIL T1: LULUS (grup Aziz, SAPI multi, AYAM tunggal, belum aktif, saldo, koreksi, tulis langsung & crew ditolak)';
END $$;
ROLLBACK;
