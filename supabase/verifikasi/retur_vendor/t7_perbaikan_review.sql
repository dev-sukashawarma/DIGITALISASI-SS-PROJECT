-- Uji 20261118120000: perbaikan review (ganti satuan & kredit saat PO kembali unpaid). ROLLBACK.
BEGIN;
DO $$
DECLARE
  c_g    uuid := gudang_pusat_id();
  c_pur  uuid := (SELECT id FROM outlet_staff WHERE role = 'purchasing' AND status = 'active' ORDER BY id LIMIT 1);
  c_fin  uuid := (SELECT id FROM outlet_staff WHERE role = 'admin_finance' AND status = 'active' ORDER BY id LIMIT 1);
  c_bank uuid := (SELECT id FROM cash_location WHERE grup = 'bahan_baku' AND kind = 'bank' AND is_active ORDER BY created_at LIMIT 1);
  p record; b record; v uuid; j jsonb; pq record; t numeric; tx uuid; src text;
BEGIN
  -- I1a: retur belum selesai menghalangi Ganti Satuan
  SELECT poi.id, poi.bahan_baku_id, po.supplier_id INTO p
  FROM purchase_order_item poi JOIN purchase_order po ON po.id = poi.purchase_order_id
  JOIN bahan_baku bb ON bb.id = poi.bahan_baku_id
  WHERE po.status = 'diterima_lengkap' AND poi.qty_terima >= 1 AND bb.satuan_kecil IS NOT NULL AND bb.faktor_tampilan > 0
    AND _retur_vendor_sisa_poi(poi.id, NULL) >= 1
  ORDER BY po.diverifikasi_at DESC NULLS LAST LIMIT 1;
  IF p.id IS NULL OR c_pur IS NULL OR c_fin IS NULL OR c_bank IS NULL THEN RAISE EXCEPTION 'T7 fixture kosong'; END IF;
  SELECT * INTO b FROM bahan_baku WHERE id = p.bahan_baku_id;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_pur, 'role', 'authenticated')::text, true);
  v := ajukan_retur_vendor(p.supplier_id, 'rusak', NULL, '{}', jsonb_build_array(jsonb_build_object('purchase_order_item_id', p.id, 'qty', 1)));
  j := _rencana_ganti_satuan(p.bahan_baku_id,
         jsonb_build_object('satuan', b.satuan, 'satuan_kecil', b.satuan_kecil, 'isi_kecil_per_tengah', b.faktor_tampilan), 1);
  IF j::text NOT LIKE '%"retur_vendor"%' THEN RAISE EXCEPTION 'T7a retur tidak jadi penghalang: %', left(j::text, 300); END IF;

  -- I1b: konversi tertulis di ganti_satuan_bahan
  SELECT prosrc INTO src FROM pg_proc WHERE proname = 'ganti_satuan_bahan';
  IF position('qty_ditolak = qty_ditolak * v_kb' in src) = 0 OR position('UPDATE public.retur_vendor_item SET qty = qty * v_kb' in src) = 0 THEN
    RAISE EXCEPTION 'T7b konversi tidak ada';
  END IF;

  -- I3: PO dibayar sebagian kredit, transaksi kas di-void → kredit dilepas
  SELECT po2.id, po2.supplier_id INTO pq FROM purchase_order po2
  WHERE po2.status IN ('sebagian_diterima','diterima_lengkap') AND po2.supplier_id IS NOT NULL
  ORDER BY po2.tanggal_po DESC LIMIT 1;
  PERFORM set_config('app.bayar_po', 'on', true);
  UPDATE purchase_order SET payment_status = 'unpaid', cash_transaction_id = NULL, paid_at = NULL WHERE id = pq.id;
  PERFORM set_config('app.bayar_po', 'off', true);
  SELECT sum(subtotal) INTO t FROM purchase_order_item WHERE purchase_order_id = pq.id;
  INSERT INTO vendor_kredit (vendor_induk, supplier_id, jumlah, status, catatan) VALUES (vendor_induk(pq.supplier_id), pq.supplier_id, t - 1, 'aktif', 'uji');
  tx := ajukan_bayar_po(pq.id, NULL, t - 1);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  PERFORM setujui_bayar_po(pq.id, 'b.jpg', NULL, c_bank);
  IF (SELECT count(*) FROM vendor_kredit WHERE purchase_order_id = pq.id AND status = 'aktif') <> 1 THEN RAISE EXCEPTION 'T7c fixture'; END IF;
  PERFORM set_config('app.bayar_po', 'on', true);  -- simulasi void oleh developer di DB
  UPDATE cash_transaction SET status = 'void' WHERE id = tx;
  PERFORM set_config('app.bayar_po', 'off', true);
  IF (SELECT payment_status FROM purchase_order WHERE id = pq.id) <> 'unpaid' THEN RAISE EXCEPTION 'T7c PO tidak unpaid'; END IF;
  IF (SELECT count(*) FROM vendor_kredit WHERE purchase_order_id = pq.id) <> 0 THEN RAISE EXCEPTION 'T7c kredit tidak dilepas'; END IF;
  IF saldo_kredit_vendor(pq.supplier_id) < t - 1 THEN RAISE EXCEPTION 'T7c saldo kredit tak kembali'; END IF;
END $$;
ROLLBACK;
