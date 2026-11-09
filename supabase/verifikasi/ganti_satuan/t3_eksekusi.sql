-- supabase/verifikasi/ganti_satuan/t3_eksekusi.sql — harapan: berakhir 'HASIL T3: LULUS' (P0001 lewat MCP)
-- Task 3: ganti_satuan_bahan. Fixture bahan Dus/Bks 6/Pcs (432) di 2 outlet, lalu Kg/gram 1000
-- jembatan 6 (k_besar 2,592), bolak-balik, penghalang, akses, dan uji kering BAWANG PUTIH BUBUK.
BEGIN;
DO $$
DECLARE
  c_bawang constant uuid := '516dd4a9-65df-4e58-adf6-d0e1f15ad9b5';
  c_kg constant jsonb := '{"satuan":"Kg","satuan_tengah":null,"faktor_tengah":null,"satuan_kecil":"gram","isi_kecil_per_tengah":1000,"satuan_po":"Kg","satuan_distribusi":"Kg"}';
  c_dus constant jsonb := '{"satuan":"Dus","satuan_tengah":"Bks","faktor_tengah":6,"satuan_kecil":"Pcs","isi_kecil_per_tengah":72,"satuan_po":"Dus","satuan_distribusi":"Bks"}';
  v_admin uuid; v_crew uuid; v_o1 uuid; v_o2 uuid; v_sup uuid; v_b uuid; v_tanpa uuid; v_op uuid; v_res uuid;
  v_l_adj uuid; v_l_tr uuid; v_l_pak uuid; v_log uuid; v_ok boolean; v_n bigint; v_alert bigint; r record;
  v_saw numeric; v_bnr numeric; v_sj numeric; v_sj_qty numeric; v_po numeric;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;
  SELECT id INTO v_crew  FROM outlet_staff WHERE role='crew'  AND status='active' LIMIT 1;
  SELECT id INTO v_o1 FROM outlets WHERE type IN ('internal','mitra') ORDER BY name LIMIT 1;
  SELECT id INTO v_o2 FROM outlets WHERE type IN ('internal','mitra') ORDER BY name OFFSET 1 LIMIT 1;
  SELECT id INTO v_sup FROM supplier WHERE is_active ORDER BY nama LIMIT 1;

  -- Fixture
  INSERT INTO bahan_baku (nama, kategori, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan,
                          satuan_po, satuan_distribusi, default_reorder_point, is_active)
  VALUES ('UJI T3 KOTAK','UJI','Dus','Bks',6,'Pcs',432,'Dus','Bks',2,true) RETURNING id INTO v_b;
  INSERT INTO bahan_baku_harga (bahan_baku_id, harga_beli) VALUES (v_b, 400000);
  INSERT INTO bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga, sumber, perlu_ditinjau, is_active)
  VALUES (v_b, v_sup, 'dus', 432, 400000, 'manual', false, true);
  INSERT INTO outlet_reorder_point (outlet_id, bahan_baku_id, reorder_point) VALUES (v_o1, v_b, 2);
  INSERT INTO resep (nama, scope, is_active) VALUES ('UJI T3 RESEP','global',true) RETURNING id INTO v_res;
  INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan) VALUES (v_res, v_b, 12, 'Pcs');
  INSERT INTO opname (outlet_id, tanggal, tipe, status, created_at) VALUES (v_o1, '2026-09-01', 'ad_hoc', 'finalized', '2026-09-01 20:00+07')
    RETURNING id INTO v_op;
  INSERT INTO opname_item (opname_id, bahan_baku_id, qty_system, qty_fisik) VALUES (v_op, v_b, 2, 800);
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, created_at)
  VALUES (v_o1, v_b, 'adjustment', 2, 'uji t3', '2026-07-01 10:00+07') RETURNING id INTO v_l_adj;
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, ref_opname_id, created_at)
  VALUES (v_o1, v_b, 'opname_selisih', 798, 'uji t3', v_op, '2026-09-01 21:00+07') RETURNING id INTO v_l_tr;
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, created_at)
  VALUES (v_o1, v_b, 'pemakaian', -805, 'uji t3', '2026-09-02 10:00+07') RETURNING id INTO v_l_pak;
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, created_at)
  VALUES (v_o2, v_b, 'adjustment', 0.5, 'uji t3', '2026-07-01 10:00+07');
  SELECT count(*) INTO v_n FROM ledger_stok WHERE bahan_baku_id = v_b;
  SELECT count(*) INTO v_alert FROM bot_telegram_stock_drop_alert_state;  -- sesudah fixture (fixture sendiri memicu alarm)

  -- (a) Ganti ke Kg/gram, jembatan 6
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_log := public.ganti_satuan_bahan(v_b, c_kg, 6, 'uji t3 ke kg');
  RESET ROLE;

  IF (SELECT satuan || '/' || satuan_kecil || '/' || faktor_tampilan::text FROM bahan_baku WHERE id = v_b) <> 'Kg/gram/1000'
     OR (SELECT satuan_diganti_at FROM bahan_baku WHERE id = v_b) IS NULL THEN
    RAISE EXCEPTION 'GAGAL (a): master %', (SELECT row_to_json(b) FROM bahan_baku b WHERE id = v_b);
  END IF;
  IF abs((SELECT default_reorder_point FROM bahan_baku WHERE id = v_b) - 5.184) > 1e-9 THEN RAISE EXCEPTION 'GAGAL (a): reorder default'; END IF;
  IF abs((SELECT saldo FROM stok_balance WHERE outlet_id = v_o1 AND bahan_baku_id = v_b) - (-30)) > 1e-9 THEN
    RAISE EXCEPTION 'GAGAL (a): saldo o1 %', (SELECT saldo FROM stok_balance WHERE outlet_id = v_o1 AND bahan_baku_id = v_b); END IF;
  IF abs((SELECT saldo FROM stok_balance WHERE outlet_id = v_o2 AND bahan_baku_id = v_b) - 1.296) > 1e-9 THEN RAISE EXCEPTION 'GAGAL (a): saldo o2'; END IF;
  SELECT * INTO r FROM ledger_stok WHERE id = v_l_adj;
  IF abs(r.qty - 5.184) > 1e-9 OR abs(r.saldo_sesudah - 5.184) > 1e-9 THEN RAISE EXCEPTION 'GAGAL (a): baris besar %', row_to_json(r); END IF;
  SELECT * INTO r FROM ledger_stok WHERE id = v_l_tr;
  IF abs(r.saldo_sebelum - 5.184) > 1e-9 OR abs(r.saldo_sesudah - 4800) > 1e-9 OR abs(r.qty - 4794.816) > 1e-9 THEN
    RAISE EXCEPTION 'GAGAL (a): baris transisi %', row_to_json(r); END IF;
  SELECT * INTO r FROM ledger_stok WHERE id = v_l_pak;
  IF abs(r.qty + 4830) > 1e-9 OR abs(r.saldo_sebelum - 4800) > 1e-9 OR abs(r.saldo_sesudah + 30) > 1e-9 THEN
    RAISE EXCEPTION 'GAGAL (a): baris kecil %', row_to_json(r); END IF;
  SELECT * INTO r FROM opname_item WHERE opname_id = v_op AND bahan_baku_id = v_b;
  IF abs(r.qty_system - 5.184) > 1e-9 OR abs(r.qty_fisik - 4800) > 1e-9 THEN RAISE EXCEPTION 'GAGAL (a): opname transisi %', row_to_json(r); END IF;
  IF (SELECT qty_per_porsi || ' ' || satuan FROM resep_item WHERE resep_id = v_res) <> '72 gram' THEN
    RAISE EXCEPTION 'GAGAL (a): resep %', (SELECT qty_per_porsi || ' ' || satuan FROM resep_item WHERE resep_id = v_res); END IF;
  IF (SELECT isi_satuan_kecil FROM bahan_baku_supplier WHERE bahan_baku_id = v_b) <> 2592 THEN RAISE EXCEPTION 'GAGAL (a): katalog'; END IF;
  IF abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_b) - 400000 / 2.592) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (a): harga %', (SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_b); END IF;
  IF abs((SELECT reorder_point FROM outlet_reorder_point WHERE outlet_id = v_o1 AND bahan_baku_id = v_b) - 5.184) > 1e-9 THEN
    RAISE EXCEPTION 'GAGAL (a): reorder outlet'; END IF;
  IF (SELECT count(*) FROM ledger_stok WHERE bahan_baku_id = v_b) <> v_n THEN RAISE EXCEPTION 'GAGAL (a): jumlah ledger berubah'; END IF;
  IF (SELECT count(*) FROM bot_telegram_stock_drop_alert_state) <> v_alert THEN RAISE EXCEPTION 'GAGAL (a): alarm bot tertulis'; END IF;
  IF NOT EXISTS (SELECT 1 FROM bahan_baku_ganti_satuan WHERE id = v_log AND bahan_baku_id = v_b AND alasan = 'uji t3 ke kg'
                 AND abs(k_besar - 2.592) < 1e-9) THEN RAISE EXCEPTION 'GAGAL (a): log'; END IF;

  -- (b) Bolak-balik: kembali ke Dus/Bks/Pcs dengan jembatan 1/6 → saldo semula
  SET LOCAL ROLE authenticated;
  PERFORM public.ganti_satuan_bahan(v_b, c_dus, 1.0 / 6, 'uji t3 balik');
  RESET ROLE;
  IF abs((SELECT saldo FROM stok_balance WHERE outlet_id = v_o1 AND bahan_baku_id = v_b) + 5) > 1e-9
     OR abs((SELECT saldo FROM stok_balance WHERE outlet_id = v_o2 AND bahan_baku_id = v_b) - 0.5) > 1e-9
     OR abs((SELECT qty FROM ledger_stok WHERE id = v_l_tr) - 798) > 1e-9
     OR abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_b) - 400000) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (b): bolak-balik tidak kembali';
  END IF;

  -- (c) Penghalang: draft opname → P0001
  INSERT INTO opname (outlet_id, tanggal, tipe, status) VALUES (v_o2, '2026-08-30', 'ad_hoc', 'draft') RETURNING id INTO v_op;
  INSERT INTO opname_item (opname_id, bahan_baku_id, qty_system, qty_fisik) VALUES (v_op, v_b, 0.5, 0.5);
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN PERFORM public.ganti_satuan_bahan(v_b, c_kg, 6, 'uji');
  EXCEPTION WHEN raise_exception THEN v_ok := SQLERRM ILIKE '%opname%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): draft opname tidak menghalangi'; END IF;
  -- alasan kosong → 22023
  v_ok := false;
  BEGIN PERFORM public.ganti_satuan_bahan(v_b, c_kg, 6, '  ');
  EXCEPTION WHEN invalid_parameter_value THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): alasan kosong diterima'; END IF;
  RESET ROLE;

  -- (d) Bahan tanpa satuan kecil → 22023; crew → 42501
  INSERT INTO bahan_baku (nama, kategori, satuan, is_active) VALUES ('UJI T3 TANPA KECIL','UJI','Pcs',true) RETURNING id INTO v_tanpa;
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN PERFORM public.ganti_satuan_bahan(v_tanpa, c_kg, 6, 'uji');
  EXCEPTION WHEN invalid_parameter_value THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (d): bahan tanpa kecil diterima'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN PERFORM public.ganti_satuan_bahan(v_b, c_kg, 6, 'uji');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (d): crew lolos'; END IF;

  -- (e) Uji kering BAWANG PUTIH BUBUK: tolak draft opname-nya di transaksi ini, lalu ganti
  UPDATE opname SET status = 'rejected'
   WHERE status IN ('draft','pending_approval')
     AND id IN (SELECT opname_id FROM opname_item WHERE bahan_baku_id = c_bawang);
  SELECT sb.saldo INTO v_saw FROM stok_balance sb JOIN outlets o ON o.id = sb.outlet_id
   WHERE sb.bahan_baku_id = c_bawang AND o.name ILIKE '%SAWANGAN (INTERNAL)%';
  SELECT sb.saldo INTO v_bnr FROM stok_balance sb JOIN outlets o ON o.id = sb.outlet_id
   WHERE sb.bahan_baku_id = c_bawang AND o.name = 'SUKA SHAWARMA BNR';
  SELECT sum(qty_dikirim * harga_snapshot), sum(qty_dikirim) INTO v_sj, v_sj_qty FROM surat_jalan_item WHERE bahan_baku_id = c_bawang;
  SELECT sum(subtotal) INTO v_po FROM purchase_order_item WHERE bahan_baku_id = c_bawang;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.ganti_satuan_bahan(c_bawang, c_kg, 6, 'uji kering t3');
  RESET ROLE;
  IF abs((SELECT sb.saldo FROM stok_balance sb JOIN outlets o ON o.id = sb.outlet_id
           WHERE sb.bahan_baku_id = c_bawang AND o.name ILIKE '%SAWANGAN (INTERNAL)%') - v_saw * 6) > 1e-9
     OR abs((SELECT sb.saldo FROM stok_balance sb JOIN outlets o ON o.id = sb.outlet_id
           WHERE sb.bahan_baku_id = c_bawang AND o.name = 'SUKA SHAWARMA BNR') - v_bnr * 2.592) > 1e-9 THEN
    RAISE EXCEPTION 'GAGAL (e): saldo bawang';
  END IF;
  IF abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = c_bawang) - 400000 / 2.592) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (e): harga bawang %', (SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = c_bawang); END IF;
  IF (SELECT isi_satuan_kecil FROM bahan_baku_supplier WHERE bahan_baku_id = c_bawang AND satuan_beli = 'dus') <> 2592 THEN
    RAISE EXCEPTION 'GAGAL (e): katalog bawang'; END IF;
  -- Dokumen selesai: nilai rupiah (qty × harga) tetap, qty berubah ×2,592
  IF abs((SELECT sum(qty_dikirim * harga_snapshot) FROM surat_jalan_item WHERE bahan_baku_id = c_bawang) - v_sj) > 0.01
     OR abs((SELECT sum(qty_dikirim) FROM surat_jalan_item WHERE bahan_baku_id = c_bawang) - v_sj_qty * 2.592) > 1e-9
     OR abs((SELECT sum(subtotal) FROM purchase_order_item WHERE bahan_baku_id = c_bawang) - v_po) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (e): nilai dokumen bergeser';
  END IF;

  RAISE EXCEPTION 'HASIL T3: LULUS (saw % -> %, bnr % -> %)', v_saw, v_saw * 6, v_bnr, v_bnr * 2.592;
END $$;
ROLLBACK;
