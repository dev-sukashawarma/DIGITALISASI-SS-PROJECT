-- Uji Task 3 sebagai crew asli outlet tes. Semua di-ROLLBACK.
-- Jalankan: supabase db query --linked -f supabase/verifikasi/drop_ship/t3_catat.sql
-- Harapan: "HASIL T3: LULUS ..."
BEGIN;
DO $$
DECLARE
  v_crew uuid; v_outlet uuid; v_lain uuid; v_bahan uuid; v_sup uuid;
  v_id uuid; v_ledger numeric; v_saldo0 numeric; v_saldo1 numeric; v_ok boolean;
BEGIN
  SELECT s.id, s.outlet_id INTO v_crew, v_outlet FROM public.outlet_staff s
    JOIN public.outlets o ON o.id = s.outlet_id
   WHERE o.type = 'test' AND s.role = 'crew' AND s.status = 'active' LIMIT 1;
  SELECT id INTO v_lain FROM public.outlets WHERE type = 'outlet' AND id <> v_outlet LIMIT 1;
  SELECT id INTO v_bahan FROM public.bahan_baku WHERE nama ILIKE '%lettuce%' LIMIT 1;
  SELECT id INTO v_sup FROM public.supplier WHERE nama = 'Lettuce (Pak Aziz) - Tempo 10';
  IF v_crew IS NULL OR v_bahan IS NULL OR v_sup IS NULL THEN
    RAISE EXCEPTION 'GAGAL: data uji tak ketemu (crew %, bahan %, supplier %)', v_crew, v_bahan, v_sup;
  END IF;

  SELECT COALESCE(saldo,0) INTO v_saldo0 FROM public.stok_balance WHERE outlet_id=v_outlet AND bahan_baku_id=v_bahan;
  v_saldo0 := COALESCE(v_saldo0, 0);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- (a) catat 5 kg -> stok outlet SENDIRI naik tepat to_ledger_scale(5)
  v_id := public.catat_terima_vendor(v_bahan, v_sup, 5, current_date, 'uji', NULL);
  SELECT sum(qty) INTO v_ledger FROM public.ledger_stok WHERE ref_terima_vendor_id = v_id;
  IF v_ledger IS DISTINCT FROM public.to_ledger_scale(v_outlet, v_bahan, 5) THEN
    RAISE EXCEPTION 'GAGAL (a): ledger % <> to_ledger_scale(5)', v_ledger;
  END IF;
  PERFORM 1 FROM public.terima_vendor_outlet WHERE id = v_id AND outlet_id = v_outlet AND harga_snapshot > 0;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL (a): outlet salah atau harga_snapshot 0'; END IF;

  -- (b) koreksi 5 -> 3: ledger bersih = to_ledger_scale(3), tak ada baris ganda
  PERFORM public.koreksi_terima_vendor(v_id, 3);
  SELECT sum(qty) INTO v_ledger FROM public.ledger_stok WHERE ref_terima_vendor_id = v_id;
  IF v_ledger IS DISTINCT FROM public.to_ledger_scale(v_outlet, v_bahan, 3) THEN
    RAISE EXCEPTION 'GAGAL (b): ledger % <> to_ledger_scale(3)', v_ledger;
  END IF;

  -- (c) batas atas: nilai > Rp 10 jt ditolak (tiga ton daging pernah lolos tanpa penjaga)
  v_ok := false;
  BEGIN PERFORM public.catat_terima_vendor(v_bahan, v_sup, 5000, current_date, NULL, NULL);
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): 5000 kg lolos'; END IF;

  -- (d) batas bawah: 0 ditolak
  v_ok := false;
  BEGIN PERFORM public.catat_terima_vendor(v_bahan, v_sup, 0, current_date, NULL, NULL);
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (d): qty 0 lolos'; END IF;

  -- (e) crew tidak bisa menulis tabel langsung
  v_ok := false;
  BEGIN INSERT INTO public.terima_vendor_outlet (outlet_id, supplier_id, bahan_baku_id, qty, tanggal_terima, dicatat_oleh)
        VALUES (v_lain, v_sup, v_bahan, 1, current_date, v_crew);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (e): INSERT langsung ke outlet lain lolos'; END IF;

  -- (f) crew tidak bisa mengoreksi catatan milik orang/outlet lain -- diuji lewat id acak
  v_ok := false;
  BEGIN PERFORM public.koreksi_terima_vendor(gen_random_uuid(), 1);
  EXCEPTION WHEN no_data_found THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f): koreksi id asing tidak ditolak'; END IF;

  -- (g) info untuk form
  PERFORM 1 FROM public.info_terima_vendor(v_bahan) WHERE supplier_id = v_sup AND harga_snapshot > 0;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL (g): info_terima_vendor tidak memuat Tempo 10'; END IF;

  -- (h) jalur mayoritas: pemakaian BOM tidak terganggu trigger baru
  INSERT INTO public.ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
  VALUES (v_outlet, v_bahan, 'pemakaian', -1, 'UJI jalur mayoritas');

  -- (i) user TANPA baris staff aktif tidak bisa mengoreksi catatan orang lain
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_ok := false;
  BEGIN PERFORM public.koreksi_terima_vendor(v_id, 1);
  EXCEPTION WHEN no_data_found THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (i): non-staff bisa mengoreksi -- celah NULL di pemeriksaan peran'; END IF;

  RAISE EXCEPTION 'HASIL T3: LULUS (catat, koreksi, batas atas & bawah, tulis langsung ditolak, id asing ditolak, info, pemakaian utuh, non-staff ditolak)';
END $$;
ROLLBACK;
