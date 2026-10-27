-- Uji akses driver (temuan review akhir C1): driver hanya MEMBACA surat jalan
-- semua outlet; tidak boleh menulis tabel ber-scope accessible_outlet_ids().
-- Harapan: error P0001 "HASIL T4: LULUS ...".
BEGIN;
DO $$
DECLARE
  v_driver uuid; v_outlet_driver uuid; v_outlet_lain uuid; v_bahan uuid;
  v_total_sj int; v_total_item int; v_n int;
BEGIN
  SELECT id, outlet_id INTO v_driver, v_outlet_driver FROM outlet_staff WHERE role = 'driver' AND status = 'active' LIMIT 1;
  SELECT id INTO v_outlet_lain FROM outlets
   WHERE is_active AND type IN ('internal','mitra') AND id IS DISTINCT FROM v_outlet_driver LIMIT 1;
  SELECT id INTO v_bahan FROM bahan_baku WHERE is_active LIMIT 1;
  SELECT count(*) INTO v_total_sj FROM surat_jalan;
  SELECT count(*) INTO v_total_item FROM surat_jalan_item;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_driver, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- 1. accessible_outlet_ids() tidak lagi memberi driver semua outlet
  SELECT count(*) INTO v_n FROM accessible_outlet_ids() WHERE accessible_outlet_ids = v_outlet_lain;
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL: accessible_outlet_ids masih memberi driver outlet lain'; END IF;

  -- 2. tulis ledger_stok outlet lain ditolak RLS
  BEGIN
    INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
    VALUES (v_outlet_lain, v_bahan, 'adjustment', 1, 'UJI T4');
    RAISE EXCEPTION 'GAGAL: driver bisa INSERT ledger_stok outlet lain';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 3. tetap membaca SEMUA surat jalan & itemnya (kebutuhan web distribusi)
  SELECT count(*) INTO v_n FROM surat_jalan;
  IF v_n <> v_total_sj THEN RAISE EXCEPTION 'GAGAL: driver melihat % dari % SJ', v_n, v_total_sj; END IF;
  SELECT count(*) INTO v_n FROM surat_jalan_item;
  IF v_n <> v_total_item THEN RAISE EXCEPTION 'GAGAL: driver melihat % dari % item SJ', v_n, v_total_item; END IF;

  -- 4. tetap tidak bisa UPDATE SJ
  UPDATE surat_jalan SET notes = notes WHERE outlet_id = v_outlet_lain;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL: driver bisa UPDATE SJ'; END IF;
  RESET ROLE;

  RAISE EXCEPTION 'HASIL T4: LULUS (driver: bukan semua outlet, tulis ledger ditolak, baca semua SJ & item, tanpa update SJ)';
END $$;
ROLLBACK;
