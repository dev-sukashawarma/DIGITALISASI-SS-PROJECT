-- Uji 20261118112000: penyelesaian retur vendor. Berakhir ROLLBACK.
BEGIN;
DO $$
DECLARE
  c_g    uuid := gudang_pusat_id();
  c_pur  uuid := (SELECT id FROM outlet_staff WHERE role = 'purchasing' AND status = 'active' ORDER BY id LIMIT 1);
  c_fin  uuid := (SELECT id FROM outlet_staff WHERE role = 'admin_finance' AND status = 'active' ORDER BY id LIMIT 1);
  c_bank uuid := (SELECT id FROM cash_location WHERE grup = 'bahan_baku' AND kind = 'bank' AND is_active LIMIT 1);
  p record; vA uuid; vB uuid; vC uuid; vD uuid; total numeric; s0 numeric; s1 numeric; k0 int; it uuid;
  h0 numeric; nh0 int;
BEGIN
  SELECT poi.id, poi.bahan_baku_id, poi.qty_terima, po.supplier_id INTO p
  FROM purchase_order_item poi JOIN purchase_order po ON po.id = poi.purchase_order_id
  WHERE po.status = 'diterima_lengkap' AND poi.qty_terima >= 4 AND poi.bahan_baku_id IS NOT NULL
    AND NOT bahan_multi_vendor(poi.bahan_baku_id) AND COALESCE(poi.harga_terima, poi.harga_pesan, 0) > 0
    AND (SELECT saldo FROM stok_balance WHERE outlet_id = c_g AND bahan_baku_id = poi.bahan_baku_id) >= to_ledger_scale(c_g, poi.bahan_baku_id, 4)
    AND _retur_vendor_sisa_poi(poi.id, NULL) >= 4
  ORDER BY po.diverifikasi_at DESC NULLS LAST LIMIT 1;
  IF p.id IS NULL OR c_pur IS NULL OR c_fin IS NULL OR c_bank IS NULL THEN RAISE EXCEPTION 'T3 fixture kosong'; END IF;

  -- empat dokumen @1 qty sampai diserahkan
  FOR i IN 1..4 LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', c_pur, 'role', 'authenticated')::text, true);
    it := ajukan_retur_vendor(p.supplier_id, 'kualitas_tidak_sesuai', NULL, '{}',
            jsonb_build_array(jsonb_build_object('purchase_order_item_id', p.id, 'qty', 1)));
    PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
    PERFORM putuskan_retur_vendor(it, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', c_pur, 'role', 'authenticated')::text, true);
    PERFORM serahkan_retur_vendor(it, 'Penerima', 'b.jpg');
    IF i = 1 THEN vA := it; ELSIF i = 2 THEN vB := it; ELSIF i = 3 THEN vC := it; ELSE vD := it; END IF;
  END LOOP;
  SELECT subtotal INTO total FROM retur_vendor_item WHERE retur_vendor_id = vA;

  -- T3a potong tagihan → kredit + selesai
  PERFORM catat_penyelesaian_retur_vendor(vA, 'potong_tagihan', 'nota kredit', NULL);
  IF (SELECT status FROM retur_vendor WHERE id = vA) <> 'selesai' THEN RAISE EXCEPTION 'T3a status'; END IF;
  IF (SELECT count(*) FROM vendor_kredit WHERE retur_vendor_id = vA AND jumlah = total AND status = 'aktif' AND vendor_induk = vendor_induk(p.supplier_id)) <> 1 THEN RAISE EXCEPTION 'T3a kredit'; END IF;
  -- T3f catat kedua kali ditolak
  BEGIN PERFORM catat_penyelesaian_retur_vendor(vA, 'uang_kembali', NULL, NULL, 1000); RAISE EXCEPTION 'T3f LOLOS';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- T3b uang kembali: purchasing tak boleh konfirmasi; finance konfirmasi lebih kecil
  PERFORM catat_penyelesaian_retur_vendor(vB, 'uang_kembali', NULL, NULL, total);
  BEGIN PERFORM konfirmasi_uang_retur_vendor(vB, c_bank, total, 'b.jpg'); RAISE EXCEPTION 'T3b purchasing LOLOS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  SELECT saldo INTO s0 FROM cash_balance WHERE cash_location_id = c_bank;
  SELECT count(*) INTO k0 FROM vendor_kredit;
  PERFORM konfirmasi_uang_retur_vendor(vB, c_bank, total - 1, 'b.jpg');
  SELECT saldo INTO s1 FROM cash_balance WHERE cash_location_id = c_bank;
  IF abs((s1 - s0) - (total - 1)) > 0.001 THEN RAISE EXCEPTION 'T3b saldo naik % harap %', s1 - s0, total - 1; END IF;
  IF (SELECT status FROM retur_vendor WHERE id = vB) <> 'selesai' OR (SELECT nilai_tidak_dikompensasi FROM retur_vendor WHERE id = vB) <> 1 THEN RAISE EXCEPTION 'T3b status/sisa'; END IF;
  IF (SELECT count(*) FROM vendor_kredit) <> k0 THEN RAISE EXCEPTION 'T3b kredit lahir'; END IF;

  -- T3c ganti barang dua tahap, harga master tak berubah
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_pur, 'role', 'authenticated')::text, true);
  PERFORM catat_penyelesaian_retur_vendor(vC, 'ganti_barang', NULL, NULL);
  SELECT harga_beli INTO h0 FROM bahan_baku_harga WHERE bahan_baku_id = p.bahan_baku_id;
  SELECT count(*) INTO nh0 FROM bahan_baku_harga_history WHERE bahan_baku_id = p.bahan_baku_id;
  SELECT saldo INTO s0 FROM stok_balance WHERE outlet_id = c_g AND bahan_baku_id = p.bahan_baku_id;
  SELECT id INTO it FROM retur_vendor_item WHERE retur_vendor_id = vC;
  PERFORM terima_pengganti_retur_vendor(vC, jsonb_build_array(jsonb_build_object('retur_vendor_item_id', it, 'qty', 0.5)));
  IF (SELECT status FROM retur_vendor WHERE id = vC) <> 'diserahkan' THEN RAISE EXCEPTION 'T3c tahap1 status'; END IF;
  -- T3d melebihi
  BEGIN PERFORM terima_pengganti_retur_vendor(vC, jsonb_build_array(jsonb_build_object('retur_vendor_item_id', it, 'qty', 1))); RAISE EXCEPTION 'T3d LOLOS';
  EXCEPTION WHEN check_violation THEN NULL; END;
  PERFORM terima_pengganti_retur_vendor(vC, jsonb_build_array(jsonb_build_object('retur_vendor_item_id', it, 'qty', 0.5)));
  IF (SELECT status FROM retur_vendor WHERE id = vC) <> 'selesai' THEN RAISE EXCEPTION 'T3c tahap2 status'; END IF;
  SELECT saldo INTO s1 FROM stok_balance WHERE outlet_id = c_g AND bahan_baku_id = p.bahan_baku_id;
  IF abs((s1 - s0) - to_ledger_scale(c_g, p.bahan_baku_id, 1)) > 0.0001 THEN RAISE EXCEPTION 'T3c saldo'; END IF;
  IF (SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = p.bahan_baku_id) IS DISTINCT FROM h0
     OR (SELECT count(*) FROM bahan_baku_harga_history WHERE bahan_baku_id = p.bahan_baku_id) <> nh0 THEN
    RAISE EXCEPTION 'T3c harga master tersentuh';
  END IF;

  -- T3e tutup sisa: tanpa alasan ditolak; ganti barang setengah lalu tutup
  PERFORM catat_penyelesaian_retur_vendor(vD, 'ganti_barang', NULL, NULL);
  SELECT id INTO it FROM retur_vendor_item WHERE retur_vendor_id = vD;
  PERFORM terima_pengganti_retur_vendor(vD, jsonb_build_array(jsonb_build_object('retur_vendor_item_id', it, 'qty', 0.5)));
  BEGIN PERFORM tutup_sisa_retur_vendor(vD, ' '); RAISE EXCEPTION 'T3e LOLOS';
  EXCEPTION WHEN check_violation THEN NULL; END;
  SELECT count(*) INTO k0 FROM vendor_kredit;
  PERFORM tutup_sisa_retur_vendor(vD, 'vendor tidak sanggup');
  IF (SELECT status FROM retur_vendor WHERE id = vD) <> 'selesai' THEN RAISE EXCEPTION 'T3e status'; END IF;
  IF abs((SELECT nilai_tidak_dikompensasi FROM retur_vendor WHERE id = vD) - total / 2) > 0.001 THEN RAISE EXCEPTION 'T3e nilai'; END IF;
  IF (SELECT count(*) FROM vendor_kredit) <> k0 THEN RAISE EXCEPTION 'T3e kredit lahir'; END IF;
END $$;
ROLLBACK;
