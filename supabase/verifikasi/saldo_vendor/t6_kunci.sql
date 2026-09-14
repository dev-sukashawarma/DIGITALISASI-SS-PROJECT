-- supabase/verifikasi/saldo_vendor/t6_kunci.sql — harapan "HASIL T6: LULUS"
-- Membuktikan penjaga sisa vendor MENGUNCI pasangan (bahan, vendor) sebelum membaca
-- sisa: saat SJ dikirim (sj_vendor_on_dikirim) dan saat penyesuaian
-- (catat_penyesuaian_gudang_vendor). Kunci = pg_advisory_xact_lock(hashtext(
-- 'svgm:<bahan>:<vendor>')). Uji konkurensi dua sesi tak bisa di satu skrip,
-- jadi yang diuji: kunci benar-benar dipegang transaksi ini. Semua di-ROLLBACK.
BEGIN;
DO $$
DECLARE
  v_sapi uuid; v_az uuid; v_dj uuid; v_kitchen uuid; v_sj uuid; v_tes uuid := 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a';
  v_n int;
BEGIN
  SELECT id INTO v_sapi FROM bahan_baku WHERE nama='SAPI' AND is_active;
  SELECT public.vendor_induk(id) INTO v_az FROM supplier WHERE nama ILIKE 'Lettuce (Pak Aziz)%' ORDER BY nama LIMIT 1;
  SELECT public.vendor_induk(id) INTO v_dj FROM supplier WHERE nama ILIKE 'Djafafood%' LIMIT 1;
  SELECT id INTO v_kitchen FROM outlet_staff WHERE role='kitchen' AND status='active' LIMIT 1;
  IF public.sisa_vendor_gudang(v_sapi, v_az) < public.to_ledger_scale(public.gudang_pusat_id(), v_sapi, 1) THEN
    RAISE EXCEPTION 'GAGAL fixture: sisa SAPI Pak Aziz < 1 Blok'; END IF;

  -- (a) SJ dikirim → kunci (SAPI, Pak Aziz) dipegang
  INSERT INTO surat_jalan (outlet_id, status, notes) VALUES (v_tes, 'draft', 'UJI t6') RETURNING id INTO v_sj;
  INSERT INTO surat_jalan_item (surat_jalan_id, bahan_baku_id, qty_dikirim, vendor_id) VALUES (v_sj, v_sapi, 1, v_az);
  UPDATE surat_jalan SET status = 'dikirim' WHERE id = v_sj;

  SELECT count(*) INTO v_n FROM pg_locks
   WHERE locktype = 'advisory' AND pid = pg_backend_pid() AND objsubid = 1
     AND objid::bigint = (hashtext('svgm:' || v_sapi::text || ':' || v_az::text)::bigint & 4294967295);
  IF v_n = 0 THEN RAISE EXCEPTION 'GAGAL (a): SJ dikirim tanpa mengunci sisa vendor'; END IF;
  IF NOT EXISTS (SELECT 1 FROM stok_vendor_gudang_mutasi m JOIN surat_jalan_item i ON i.id = m.ref_surat_jalan_item_id
                  WHERE i.surat_jalan_id = v_sj AND m.sumber = 'sj_kirim' AND m.vendor_id = v_az) THEN
    RAISE EXCEPTION 'GAGAL (a): mutasi sj_kirim tidak tertulis'; END IF;

  -- (b) penyesuaian dua pasangan (urutan input terbalik) → kunci Djafafood juga dipegang
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_kitchen, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.catat_penyesuaian_gudang_vendor(jsonb_build_array(
    jsonb_build_object('bahan_baku_id', v_sapi, 'vendor_id', v_az, 'tipe','adjustment', 'qty_besar', 1, 'catatan','UJI t6'),
    jsonb_build_object('bahan_baku_id', v_sapi, 'vendor_id', v_dj, 'tipe','adjustment', 'qty_besar', 1, 'catatan','UJI t6')));
  RESET ROLE;
  SELECT count(*) INTO v_n FROM pg_locks
   WHERE locktype = 'advisory' AND pid = pg_backend_pid() AND objsubid = 1
     AND objid::bigint = (hashtext('svgm:' || v_sapi::text || ':' || v_dj::text)::bigint & 4294967295);
  IF v_n = 0 THEN RAISE EXCEPTION 'GAGAL (b): penyesuaian tanpa kunci'; END IF;

  -- (c) penjaga sisa tetap menolak kiriman melebihi sisa
  BEGIN
    INSERT INTO surat_jalan (outlet_id, status, notes) VALUES (v_tes, 'draft', 'UJI t6 lebih') RETURNING id INTO v_sj;
    INSERT INTO surat_jalan_item (surat_jalan_id, bahan_baku_id, qty_dikirim, vendor_id)
    VALUES (v_sj, v_sapi, public.sisa_vendor_gudang(v_sapi, v_dj) / public.to_ledger_scale(public.gudang_pusat_id(), v_sapi, 1) + 1, v_dj);
    UPDATE surat_jalan SET status = 'dikirim' WHERE id = v_sj;
    RAISE EXCEPTION 'GAGAL (c): kiriman melebihi sisa lolos';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE 'Sisa SAPI Djafafood%' THEN RAISE EXCEPTION 'GAGAL (c): pesan lain: %', SQLERRM; END IF;
  END;

  RAISE EXCEPTION 'HASIL T6: LULUS (kirim SJ & penyesuaian mengunci sisa vendor; penjaga sisa tetap menolak)';
END $$;
ROLLBACK;
