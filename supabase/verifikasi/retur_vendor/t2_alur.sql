-- Uji 20261118111000: alur retur vendor. Berakhir ROLLBACK.
-- Fixture: PO diterima terbaru — satu bahan satu-vendor (STIKER) & satu multi-vendor (MAYONAISE).
BEGIN;
DO $$
DECLARE
  c_g    uuid := gudang_pusat_id();
  c_pur  uuid := (SELECT id FROM outlet_staff WHERE role = 'purchasing' AND status = 'active' ORDER BY id LIMIT 1);
  c_fin  uuid := (SELECT id FROM outlet_staff WHERE role = 'admin_finance' AND status = 'active' ORDER BY id LIMIT 1);
  c_crew uuid := (SELECT id FROM outlet_staff WHERE role = 'crew' AND status = 'active' ORDER BY id LIMIT 1);
  p1 record; p2 record; v1 uuid; v2 uuid; s0 numeric; s1 numeric; n int; q numeric; sv0 numeric;
BEGIN
  -- satu-vendor
  SELECT poi.id, poi.bahan_baku_id, poi.qty_terima, COALESCE(poi.harga_terima, poi.harga_pesan) harga, po.supplier_id INTO p1
  FROM purchase_order_item poi JOIN purchase_order po ON po.id = poi.purchase_order_id
  WHERE po.status = 'diterima_lengkap' AND poi.qty_terima > 1 AND poi.bahan_baku_id IS NOT NULL
    AND NOT bahan_multi_vendor(poi.bahan_baku_id)
    AND (SELECT saldo FROM stok_balance WHERE outlet_id = c_g AND bahan_baku_id = poi.bahan_baku_id) > to_ledger_scale(c_g, poi.bahan_baku_id, 1)
  ORDER BY po.diverifikasi_at DESC NULLS LAST LIMIT 1;
  -- multi-vendor
  SELECT poi.id, poi.bahan_baku_id, poi.qty_terima, po.supplier_id INTO p2
  FROM purchase_order_item poi JOIN purchase_order po ON po.id = poi.purchase_order_id
  WHERE po.status = 'diterima_lengkap' AND poi.qty_terima >= 1 AND poi.bahan_baku_id IS NOT NULL
    AND bahan_multi_vendor(poi.bahan_baku_id) AND bahan_vendor_aktif(poi.bahan_baku_id)
    AND sisa_vendor_gudang(poi.bahan_baku_id, vendor_induk(po.supplier_id)) >= to_ledger_scale(c_g, poi.bahan_baku_id, 1)
  ORDER BY po.diverifikasi_at DESC NULLS LAST LIMIT 1;
  IF c_pur IS NULL OR c_fin IS NULL OR c_crew IS NULL OR p1.id IS NULL OR p2.id IS NULL THEN RAISE EXCEPTION 'T2 fixture kosong'; END IF;

  -- T2a crew ditolak
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_crew, 'role', 'authenticated')::text, true);
  BEGIN PERFORM ajukan_retur_vendor(p1.supplier_id, 'rusak', NULL, '{}', jsonb_build_array(jsonb_build_object('purchase_order_item_id', p1.id, 'qty', 1)));
    RAISE EXCEPTION 'T2a LOLOS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- T2b purchasing ajukan
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_pur, 'role', 'authenticated')::text, true);
  v1 := ajukan_retur_vendor(p1.supplier_id, 'kualitas_tidak_sesuai', 'uji', '{}',
          jsonb_build_array(jsonb_build_object('purchase_order_item_id', p1.id, 'qty', 1)));
  IF (SELECT status FROM retur_vendor WHERE id = v1) <> 'diajukan' OR (SELECT nomor FROM retur_vendor WHERE id = v1) NOT LIKE 'RV/%' THEN RAISE EXCEPTION 'T2b status/nomor'; END IF;
  IF (SELECT harga FROM retur_vendor_item WHERE retur_vendor_id = v1) IS DISTINCT FROM p1.harga THEN RAISE EXCEPTION 'T2b harga'; END IF;

  -- T2c dokumen kedua melebihi sisa
  BEGIN PERFORM ajukan_retur_vendor(p1.supplier_id, 'rusak', NULL, '{}', jsonb_build_array(jsonb_build_object('purchase_order_item_id', p1.id, 'qty', p1.qty_terima)));
    RAISE EXCEPTION 'T2c LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%melebihi%' THEN RAISE; END IF; END;

  -- T2g item PO vendor lain
  BEGIN PERFORM ajukan_retur_vendor(p1.supplier_id, 'rusak', NULL, '{}', jsonb_build_array(jsonb_build_object('purchase_order_item_id', p2.id, 'qty', 1)));
    RAISE EXCEPTION 'T2g LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%bukan milik vendor%' THEN RAISE; END IF; END;

  -- T2d pengaju tak boleh memutuskan (purchasing juga bukan role putus)
  BEGIN PERFORM putuskan_retur_vendor(v1, true); RAISE EXCEPTION 'T2d LOLOS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  -- T2h tolak tanpa alasan
  BEGIN PERFORM putuskan_retur_vendor(v1, false, ' '); RAISE EXCEPTION 'T2h LOLOS';
  EXCEPTION WHEN check_violation THEN NULL; END;
  PERFORM putuskan_retur_vendor(v1, true);
  IF (SELECT status FROM retur_vendor WHERE id = v1) <> 'disetujui' THEN RAISE EXCEPTION 'T2d status'; END IF;
  IF (SELECT count(*) FROM approval_log WHERE jenis = 'retur_vendor' AND sumber_id = v1 AND keputusan = 'setuju') <> 1 THEN RAISE EXCEPTION 'T2d log'; END IF;

  -- T2e saldo gudang tidak cukup → ditolak, nol ledger
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_pur, 'role', 'authenticated')::text, true);
  SELECT saldo INTO s0 FROM stok_balance WHERE outlet_id = c_g AND bahan_baku_id = p1.bahan_baku_id;
  UPDATE stok_balance SET saldo = 0 WHERE outlet_id = c_g AND bahan_baku_id = p1.bahan_baku_id;
  BEGIN PERFORM serahkan_retur_vendor(v1, 'Budi', 'b.jpg'); RAISE EXCEPTION 'T2e LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%tidak cukup%' THEN RAISE; END IF; END;
  IF EXISTS (SELECT 1 FROM ledger_stok WHERE ref_retur_vendor_id = v1) THEN RAISE EXCEPTION 'T2e ledger lahir'; END IF;
  UPDATE stok_balance SET saldo = s0 WHERE outlet_id = c_g AND bahan_baku_id = p1.bahan_baku_id;

  -- T2f serah → stok turun tepat
  BEGIN PERFORM serahkan_retur_vendor(v1, 'Budi', ' '); RAISE EXCEPTION 'T2f bukti LOLOS';
  EXCEPTION WHEN check_violation THEN NULL; END;
  PERFORM serahkan_retur_vendor(v1, 'Budi', 'b.jpg');
  q := to_ledger_scale(c_g, p1.bahan_baku_id, 1);
  SELECT saldo INTO s1 FROM stok_balance WHERE outlet_id = c_g AND bahan_baku_id = p1.bahan_baku_id;
  IF abs((s0 - s1) - q) > 0.0001 THEN RAISE EXCEPTION 'T2f saldo turun % harap %', s0 - s1, q; END IF;
  IF (SELECT status FROM retur_vendor WHERE id = v1) <> 'diserahkan' THEN RAISE EXCEPTION 'T2f status'; END IF;
  -- T2h batal setelah diserahkan
  BEGIN PERFORM batalkan_retur_vendor(v1, 'x'); RAISE EXCEPTION 'T2h batal LOLOS';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- T2f' multi-vendor: mutasi vendor ditulis & terhubung ke ledger
  sv0 := sisa_vendor_gudang(p2.bahan_baku_id, vendor_induk(p2.supplier_id));
  v2 := ajukan_retur_vendor(p2.supplier_id, 'rusak', NULL, '{}', jsonb_build_array(jsonb_build_object('purchase_order_item_id', p2.id, 'qty', 1)));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  PERFORM putuskan_retur_vendor(v2, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_pur, 'role', 'authenticated')::text, true);
  PERFORM serahkan_retur_vendor(v2, NULL, 'b.jpg');
  SELECT count(*) INTO n FROM stok_vendor_gudang_mutasi m JOIN ledger_stok l ON l.id = m.ref_ledger_id
  WHERE l.ref_retur_vendor_id = v2 AND m.sumber = 'retur_vendor' AND m.qty = l.qty;
  IF n <> 1 THEN RAISE EXCEPTION 'T2f multi mutasi %', n; END IF;
  IF abs((sv0 - sisa_vendor_gudang(p2.bahan_baku_id, vendor_induk(p2.supplier_id))) - to_ledger_scale(c_g, p2.bahan_baku_id, 1)) > 0.0001 THEN
    RAISE EXCEPTION 'T2f multi sisa vendor';
  END IF;
END $$;
ROLLBACK;
