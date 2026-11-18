-- Uji 20261118115000: ringkasan kualitas vendor. Berakhir ROLLBACK.
BEGIN;
DO $$
DECLARE
  c_g    uuid := gudang_pusat_id();
  c_pur  uuid := (SELECT id FROM outlet_staff WHERE role = 'purchasing' AND status = 'active' ORDER BY id LIMIT 1);
  c_fin  uuid := (SELECT id FROM outlet_staff WHERE role = 'admin_finance' AND status = 'active' ORDER BY id LIMIT 1);
  c_kit  uuid := (SELECT id FROM outlet_staff WHERE role = 'kitchen' AND status = 'active' ORDER BY id LIMIT 1);
  c_crew uuid := (SELECT id FROM outlet_staff WHERE role = 'crew' AND status = 'active' ORDER BY id LIMIT 1);
  p record; v uuid; sub numeric; c_b uuid; po uuid; it uuid; r record;
BEGIN
  SELECT poi.id, poi.qty_terima, po.supplier_id INTO p
  FROM purchase_order_item poi JOIN purchase_order po ON po.id = poi.purchase_order_id
  WHERE po.status = 'diterima_lengkap' AND poi.qty_terima >= 1 AND poi.bahan_baku_id IS NOT NULL
    AND NOT bahan_multi_vendor(poi.bahan_baku_id) AND COALESCE(poi.harga_terima, poi.harga_pesan, 0) > 0
    AND (SELECT saldo FROM stok_balance WHERE outlet_id = c_g AND bahan_baku_id = poi.bahan_baku_id) >= to_ledger_scale(c_g, poi.bahan_baku_id, 1)
    AND _retur_vendor_sisa_poi(poi.id, NULL) >= 1
  ORDER BY po.diverifikasi_at DESC NULLS LAST LIMIT 1;
  IF p.id IS NULL THEN RAISE EXCEPTION 'T6 fixture kosong'; END IF;

  -- satu retur selesai via potong tagihan, alasan salah_kirim (jarang dipakai → mudah dipisah)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_pur, 'role', 'authenticated')::text, true);
  v := ajukan_retur_vendor(p.supplier_id, 'salah_kirim', NULL, '{}', jsonb_build_array(jsonb_build_object('purchase_order_item_id', p.id, 'qty', 1)));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  PERFORM putuskan_retur_vendor(v, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_pur, 'role', 'authenticated')::text, true);
  PERFORM serahkan_retur_vendor(v, NULL, 'b.jpg');
  PERFORM tutup_sisa_retur_vendor(v, 'vendor tak respons');
  SELECT subtotal INTO sub FROM retur_vendor_item WHERE retur_vendor_id = v;

  -- satu PO dengan tolak 2 @1000 (kadaluarsa) dari vendor yang sama
  SELECT b.id INTO c_b FROM bahan_baku b WHERE b.is_active AND NOT bahan_multi_vendor(b.id) AND to_ledger_scale(c_g, b.id, 1) > 0 LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_kit, 'role', 'authenticated')::text, true);
  INSERT INTO purchase_order (nomor_po, supplier_id, supplier_nama, tanggal_po, status)
  VALUES ('UJI/T6', p.supplier_id, 'Uji', current_date, 'dikirim_ke_supplier') RETURNING id INTO po;
  INSERT INTO purchase_order_item (purchase_order_id, bahan_baku_id, qty_pesan, harga_pesan) VALUES (po, c_b, 5, 1000) RETURNING id INTO it;
  PERFORM verifikasi_terima_po(po, jsonb_build_array(jsonb_build_object('id', it, 'qty_datang', 3, 'qty_ditolak', 2, 'alasan_tolak', 'kadaluarsa')));

  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  SELECT * INTO r FROM ringkasan_kualitas_vendor(current_date - 1, current_date + 1)
  WHERE vendor_induk = vendor_induk(p.supplier_id) AND alasan = 'salah_kirim';
  IF NOT FOUND THEN RAISE EXCEPTION 'T6a baris tidak ada'; END IF;
  IF r.jumlah_retur <> 1 OR abs(r.nilai_retur - sub) > 0.001 OR abs(r.nilai_tidak_dikompensasi - sub) > 0.001 THEN RAISE EXCEPTION 'T6a retur %', r; END IF;
  SELECT * INTO r FROM ringkasan_kualitas_vendor(current_date - 1, current_date + 1)
  WHERE vendor_induk = vendor_induk(p.supplier_id) AND alasan = 'kadaluarsa';
  IF NOT FOUND THEN RAISE EXCEPTION 'T6b baris tidak ada'; END IF;
  IF r.jumlah_baris_tolak <> 1 OR r.nilai_tolak <> 2000 THEN RAISE EXCEPTION 'T6b tolak %', r; END IF;

  -- T6c crew ditolak
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_crew, 'role', 'authenticated')::text, true);
  BEGIN PERFORM * FROM ringkasan_kualitas_vendor(current_date - 1, current_date + 1); RAISE EXCEPTION 'T6c LOLOS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
