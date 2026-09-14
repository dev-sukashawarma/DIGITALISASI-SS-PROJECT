-- supabase/verifikasi/saldo_vendor/t5_penyesuaian.sql — harapan "HASIL T5: LULUS"
-- Berjalan sebagai staf kitchen asli (jwt claims + role authenticated), di dalam
-- transaksi yang dibatalkan. Penjaga DEFERRED dipicu dengan SET CONSTRAINTS ALL IMMEDIATE.
BEGIN;
DO $$
DECLARE
  v_kitchen uuid; v_crew uuid; v_sapi uuid; v_ayam uuid; v_az uuid; v_dj uuid;
  v_sisa_az numeric; v_f numeric; v_n int; v_total_sebelum numeric; v_total_sesudah numeric;
  v_ok boolean;
BEGIN
  SELECT id INTO v_sapi FROM bahan_baku WHERE nama='SAPI' AND is_active;
  SELECT id INTO v_ayam FROM bahan_baku WHERE nama='AYAM' AND is_active;
  SELECT public.vendor_induk(id) INTO v_az FROM supplier WHERE nama ILIKE 'Lettuce (Pak Aziz)%' ORDER BY nama LIMIT 1;
  SELECT public.vendor_induk(id) INTO v_dj FROM supplier WHERE nama ILIKE 'Djafafood%' LIMIT 1;
  SELECT id INTO v_kitchen FROM outlet_staff WHERE role='kitchen' AND status='active' LIMIT 1;
  SELECT id INTO v_crew FROM outlet_staff WHERE role='crew' AND status='active' LIMIT 1;
  IF v_sapi IS NULL OR v_ayam IS NULL OR v_az IS NULL OR v_dj IS NULL OR v_kitchen IS NULL OR v_crew IS NULL THEN
    RAISE EXCEPTION 'GAGAL: fixture tidak lengkap';
  END IF;
  v_f := public.to_ledger_scale(public.gudang_pusat_id(), v_sapi, 1);

  -- Stok SAPI cukup untuk uji pengurangan: tambahkan dulu 5 Blok ke Djafafood via RPC (a).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_kitchen, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- (a) penambahan 5 Blok ke Djafafood → 1 ledger + 1 mutasi +5
  SELECT public.sisa_vendor_gudang(v_sapi, v_dj) INTO v_total_sebelum;
  PERFORM public.catat_penyesuaian_gudang_vendor(jsonb_build_array(jsonb_build_object(
    'bahan_baku_id', v_sapi, 'vendor_id', v_dj, 'tipe','adjustment', 'qty_besar', 5, 'catatan','UJI t5 masuk')));
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
  IF public.sisa_vendor_gudang(v_sapi, v_dj) - v_total_sebelum <> 5 * v_f THEN
    RAISE EXCEPTION 'GAGAL (a): sisa Djafafood tidak naik 5 Blok';
  END IF;
  SELECT count(*) INTO v_n FROM ledger_stok WHERE catatan='UJI t5 masuk' AND tipe='adjustment' AND qty = 5 * v_f AND created_by = v_kitchen;
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL (a): ledger n=%', v_n; END IF;

  -- (b) pecah: kurangi 2 Djafafood + 1 Pak Aziz (transfer_keluar) → dua baris, dua mutasi
  v_sisa_az := public.sisa_vendor_gudang(v_sapi, v_az);
  PERFORM public.catat_penyesuaian_gudang_vendor(jsonb_build_array(
    jsonb_build_object('bahan_baku_id', v_sapi, 'vendor_id', v_dj, 'tipe','adjustment', 'qty_besar', -2, 'catatan','UJI t5 keluar'),
    jsonb_build_object('bahan_baku_id', v_sapi, 'vendor_id', v_az, 'tipe','transfer_keluar', 'qty_besar', 1, 'catatan','UJI t5 keluar')));
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
  IF public.sisa_vendor_gudang(v_sapi, v_az) <> v_sisa_az - v_f THEN RAISE EXCEPTION 'GAGAL (b): Pak Aziz tidak turun 1'; END IF;
  SELECT count(*) INTO v_n FROM ledger_stok l JOIN stok_vendor_gudang_mutasi m ON m.ref_ledger_id=l.id AND m.sumber='penyesuaian'
   WHERE l.catatan='UJI t5 keluar' AND m.qty = l.qty;
  IF v_n <> 2 THEN RAISE EXCEPTION 'GAGAL (b): pasangan ledger/mutasi n=%', v_n; END IF;

  -- (b2) RPC tetap jalan walau sesi menyetel constraint IMMEDIATE
  SET CONSTRAINTS ALL IMMEDIATE;
  PERFORM public.catat_penyesuaian_gudang_vendor(jsonb_build_array(jsonb_build_object(
    'bahan_baku_id', v_sapi, 'vendor_id', v_dj, 'tipe','adjustment', 'qty_besar', 1, 'catatan','UJI t5 immediate')));
  SET CONSTRAINTS ALL DEFERRED;

  -- (c) pengurangan melebihi sisa vendor ditolak
  v_ok := false;
  BEGIN
    PERFORM public.catat_penyesuaian_gudang_vendor(jsonb_build_array(jsonb_build_object(
      'bahan_baku_id', v_sapi, 'vendor_id', v_dj, 'tipe','adjustment',
      'qty_besar', -(public.sisa_vendor_gudang(v_sapi, v_dj) / v_f + 1), 'catatan','UJI t5 lebih')));
  EXCEPTION WHEN check_violation THEN
    v_ok := SQLERRM LIKE 'Sisa SAPI Djafafood%';
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): pengurangan melebihi sisa tidak ditolak dengan pesan sisa'; END IF;

  -- (d) insert langsung SAPI tanpa vendor ditolak saat constraint dicek
  v_ok := false;
  BEGIN
    INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, created_by)
    VALUES (public.gudang_pusat_id(), v_sapi, 'adjustment', -1, 'UJI t5 langsung', v_kitchen);
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN check_violation THEN
    v_ok := SQLERRM LIKE '%pilih vendor%';
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (d): insert langsung tanpa vendor lolos'; END IF;
  SET CONSTRAINTS ALL DEFERRED;

  -- (e) bahan satu-vendor (AYAM) insert langsung tetap lolos
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, created_by)
  VALUES (public.gudang_pusat_id(), v_ayam, 'adjustment', 1, 'UJI t5 ayam', v_kitchen);
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  -- (f) crew ditolak memakai RPC
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  v_ok := false;
  BEGIN
    PERFORM public.catat_penyesuaian_gudang_vendor(jsonb_build_array(jsonb_build_object(
      'bahan_baku_id', v_sapi, 'vendor_id', v_dj, 'tipe','adjustment', 'qty_besar', 1, 'catatan','UJI t5 crew')));
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f): crew bisa memakai RPC'; END IF;

  RESET ROLE;
  -- (g) outlet lain: adjustment SAPI tanpa vendor lolos (penjaga hanya Gudang Pusat)
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
  SELECT sb.outlet_id, v_sapi, 'adjustment', 1, 'UJI t5 outlet lain'
    FROM stok_balance sb WHERE sb.bahan_baku_id = v_sapi AND sb.outlet_id <> public.gudang_pusat_id() LIMIT 1;
  SET CONSTRAINTS ALL IMMEDIATE;

  RAISE EXCEPTION 'HASIL T5: LULUS (masuk/pecah tercatat per vendor, lebih-sisa & tanpa-vendor ditolak, satu-vendor/outlet lain lolos, crew ditolak)';
END $$;
ROLLBACK;
