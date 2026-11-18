-- Uji 20261118114000: barang ditolak saat terima PO tidak ditagih. Berakhir ROLLBACK.
BEGIN;
DO $$
DECLARE
  c_g   uuid := gudang_pusat_id();
  c_pur uuid := (SELECT id FROM outlet_staff WHERE role = 'kitchen' AND status = 'active' ORDER BY id LIMIT 1);
  c_b   uuid; c_sup uuid; po uuid; it uuid; s0 numeric; s1 numeric; r record; h0 numeric; h1 numeric;
BEGIN
  -- bahan satu-vendor yang skalanya bisa dihitung
  SELECT b.id INTO c_b FROM bahan_baku b WHERE b.is_active AND NOT bahan_multi_vendor(b.id)
    AND to_ledger_scale(c_g, b.id, 1) > 0 ORDER BY b.nama LIMIT 1;
  SELECT id INTO c_sup FROM supplier WHERE COALESCE(is_active, true) ORDER BY created_at LIMIT 1;
  IF c_pur IS NULL OR c_b IS NULL OR c_sup IS NULL THEN RAISE EXCEPTION 'T5 fixture kosong'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_pur, 'role', 'authenticated')::text, true);

  -- T5a datang 10 tolak 3
  INSERT INTO purchase_order (nomor_po, supplier_id, supplier_nama, tanggal_po, status)
  VALUES ('UJI/T5A', c_sup, 'Uji', current_date, 'dikirim_ke_supplier') RETURNING id INTO po;
  INSERT INTO purchase_order_item (purchase_order_id, bahan_baku_id, qty_pesan, harga_pesan)
  VALUES (po, c_b, 10, 1000) RETURNING id INTO it;
  SELECT COALESCE(saldo, 0) INTO s0 FROM stok_balance WHERE outlet_id = c_g AND bahan_baku_id = c_b;
  s0 := COALESCE(s0, 0);
  PERFORM verifikasi_terima_po(po, jsonb_build_array(jsonb_build_object('id', it, 'qty_datang', 7, 'qty_ditolak', 3, 'alasan_tolak', 'kualitas_tidak_sesuai')));
  SELECT qty_terima, qty_ditolak, alasan_tolak, subtotal INTO r FROM purchase_order_item WHERE id = it;
  IF r.qty_terima <> 7 OR r.qty_ditolak <> 3 OR r.alasan_tolak <> 'kualitas_tidak_sesuai' OR r.subtotal <> 7000 THEN RAISE EXCEPTION 'T5a item %', r; END IF;
  IF (SELECT status FROM purchase_order WHERE id = po) <> 'diterima_lengkap' THEN RAISE EXCEPTION 'T5a status'; END IF;
  SELECT COALESCE(saldo, 0) INTO s1 FROM stok_balance WHERE outlet_id = c_g AND bahan_baku_id = c_b;
  IF abs((s1 - s0) - to_ledger_scale(c_g, c_b, 7)) > 0.0001 THEN RAISE EXCEPTION 'T5a ledger % harap %', s1 - s0, to_ledger_scale(c_g, c_b, 7); END IF;

  -- T5b bertahap: 6 tolak 1, lalu 4 tolak 0
  INSERT INTO purchase_order (nomor_po, supplier_id, supplier_nama, tanggal_po, status)
  VALUES ('UJI/T5B', c_sup, 'Uji', current_date, 'dikirim_ke_supplier') RETURNING id INTO po;
  INSERT INTO purchase_order_item (purchase_order_id, bahan_baku_id, qty_pesan, harga_pesan)
  VALUES (po, c_b, 10, 1000) RETURNING id INTO it;
  PERFORM verifikasi_terima_po(po, jsonb_build_array(jsonb_build_object('id', it, 'qty_datang', 5, 'qty_ditolak', 1, 'alasan_tolak', 'rusak')));
  IF (SELECT status FROM purchase_order WHERE id = po) <> 'sebagian_diterima' THEN RAISE EXCEPTION 'T5b status1'; END IF;
  PERFORM verifikasi_terima_po(po, jsonb_build_array(jsonb_build_object('id', it, 'qty_datang', 4)));
  SELECT qty_terima, qty_ditolak INTO r FROM purchase_order_item WHERE id = it;
  IF r.qty_terima <> 9 OR r.qty_ditolak <> 1 THEN RAISE EXCEPTION 'T5b item %', r; END IF;
  IF (SELECT status FROM purchase_order WHERE id = po) <> 'diterima_lengkap' THEN RAISE EXCEPTION 'T5b status2'; END IF;

  -- T5c ditolak tanpa alasan
  INSERT INTO purchase_order (nomor_po, supplier_id, supplier_nama, tanggal_po, status)
  VALUES ('UJI/T5C', c_sup, 'Uji', current_date, 'dikirim_ke_supplier') RETURNING id INTO po;
  INSERT INTO purchase_order_item (purchase_order_id, bahan_baku_id, qty_pesan, harga_pesan)
  VALUES (po, c_b, 10, 1000) RETURNING id INTO it;
  BEGIN PERFORM verifikasi_terima_po(po, jsonb_build_array(jsonb_build_object('id', it, 'qty_datang', 5, 'qty_ditolak', 2)));
    RAISE EXCEPTION 'T5c LOLOS';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- T5c' semua ditolak (qty_datang 0) → nol ledger, status sebagian
  SELECT COALESCE(saldo, 0) INTO s0 FROM stok_balance WHERE outlet_id = c_g AND bahan_baku_id = c_b;
  PERFORM verifikasi_terima_po(po, jsonb_build_array(jsonb_build_object('id', it, 'qty_datang', 0, 'qty_ditolak', 4, 'alasan_tolak', 'salah_kirim')));
  SELECT COALESCE(saldo, 0) INTO s1 FROM stok_balance WHERE outlet_id = c_g AND bahan_baku_id = c_b;
  IF s1 <> s0 OR (SELECT qty_ditolak FROM purchase_order_item WHERE id = it) <> 4 THEN RAISE EXCEPTION 'T5c semua ditolak'; END IF;

  -- T5d payload lama (qty_terima total) identik dengan perilaku lama
  INSERT INTO purchase_order (nomor_po, supplier_id, supplier_nama, tanggal_po, status)
  VALUES ('UJI/T5D', c_sup, 'Uji', current_date, 'dikirim_ke_supplier') RETURNING id INTO po;
  INSERT INTO purchase_order_item (purchase_order_id, bahan_baku_id, qty_pesan, harga_pesan)
  VALUES (po, c_b, 10, 1000) RETURNING id INTO it;
  PERFORM verifikasi_terima_po(po, jsonb_build_array(jsonb_build_object('id', it, 'qty_terima', 10)));
  SELECT qty_terima, qty_ditolak INTO r FROM purchase_order_item WHERE id = it;
  IF r.qty_terima <> 10 OR r.qty_ditolak <> 0 OR (SELECT status FROM purchase_order WHERE id = po) <> 'diterima_lengkap' THEN RAISE EXCEPTION 'T5d'; END IF;

  -- T5e PO uji coba tetap tak menulis harga master
  SELECT harga_beli INTO h0 FROM bahan_baku_harga WHERE bahan_baku_id = c_b;
  INSERT INTO purchase_order (nomor_po, supplier_id, supplier_nama, tanggal_po, status)
  VALUES ('TEST/T5E', c_sup, 'Uji', current_date, 'dikirim_ke_supplier') RETURNING id INTO po;
  INSERT INTO purchase_order_item (purchase_order_id, bahan_baku_id, qty_pesan, harga_pesan)
  VALUES (po, c_b, 2, 1) RETURNING id INTO it;
  PERFORM verifikasi_terima_po(po, jsonb_build_array(jsonb_build_object('id', it, 'qty_datang', 1, 'qty_ditolak', 1, 'alasan_tolak', 'rusak', 'harga_terima', 7)));
  SELECT harga_beli INTO h1 FROM bahan_baku_harga WHERE bahan_baku_id = c_b;
  IF h1 IS DISTINCT FROM h0 THEN RAISE EXCEPTION 'T5e harga master berubah'; END IF;
END $$;
ROLLBACK;
