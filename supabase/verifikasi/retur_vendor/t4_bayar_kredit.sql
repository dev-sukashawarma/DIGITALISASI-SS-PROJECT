-- Uji 20261118113000: bayar PO memakai kredit vendor. Berakhir ROLLBACK.
-- Fixture: dua PO diterima & belum dibayar dari vendor induk yang sama (dibuat dari PO nyata
-- dengan payment_status direset di dalam transaksi), kredit disuntik langsung.
BEGIN;
DO $$
DECLARE
  c_pur  uuid := (SELECT id FROM outlet_staff WHERE role = 'purchasing' AND status = 'active' ORDER BY id LIMIT 1);
  c_fin  uuid := (SELECT id FROM outlet_staff WHERE role = 'admin_finance' AND status = 'active' ORDER BY id LIMIT 1);
  c_bank uuid := (SELECT id FROM cash_location WHERE grup = 'bahan_baku' AND kind = 'bank' AND is_active ORDER BY created_at LIMIT 1);
  a record; b record; ind uuid; ta numeric; tb numeric; tx uuid; s0 numeric; s1 numeric; sup2 uuid; n int;
BEGIN
  -- dua PO diterima dari supplier yang sama; reset status bayar di transaksi ini
  SELECT po.supplier_id INTO sup2 FROM purchase_order po
  WHERE po.status IN ('sebagian_diterima','diterima_lengkap') AND po.supplier_id IS NOT NULL
  GROUP BY po.supplier_id HAVING count(*) >= 2 ORDER BY max(po.tanggal_po) DESC LIMIT 1;
  SELECT id, supplier_id INTO a FROM purchase_order WHERE supplier_id = sup2 AND status IN ('sebagian_diterima','diterima_lengkap') ORDER BY tanggal_po DESC LIMIT 1;
  SELECT id, supplier_id INTO b FROM purchase_order WHERE supplier_id = sup2 AND status IN ('sebagian_diterima','diterima_lengkap') AND id <> a.id ORDER BY tanggal_po DESC LIMIT 1;
  IF a.id IS NULL OR b.id IS NULL OR c_pur IS NULL OR c_fin IS NULL OR c_bank IS NULL THEN RAISE EXCEPTION 'T4 fixture kosong'; END IF;
  PERFORM set_config('app.bayar_po', 'on', true);
  UPDATE purchase_order SET payment_status = 'unpaid', cash_transaction_id = NULL, paid_at = NULL, paid_amount = NULL WHERE id IN (a.id, b.id);
  PERFORM set_config('app.bayar_po', 'off', true);
  ind := vendor_induk(sup2);
  SELECT sum(subtotal) INTO ta FROM purchase_order_item WHERE purchase_order_id = a.id;
  SELECT sum(subtotal) INTO tb FROM purchase_order_item WHERE purchase_order_id = b.id;
  IF ta IS NULL OR ta <= 2 OR tb IS NULL OR tb <= 2 THEN RAISE EXCEPTION 'T4 fixture total'; END IF;
  DELETE FROM vendor_kredit WHERE vendor_induk = ind;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_pur, 'role', 'authenticated')::text, true);

  -- T4a kredit 0 → perilaku lama
  tx := ajukan_bayar_po(a.id);
  IF (SELECT amount FROM cash_transaction WHERE id = tx) <> ta THEN RAISE EXCEPTION 'T4a amount'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  PERFORM tolak_bayar_po(a.id, 'uji');
  IF (SELECT payment_status FROM purchase_order WHERE id = a.id) <> 'unpaid' THEN RAISE EXCEPTION 'T4a reset'; END IF;

  -- kredit 1 rupiah kurang dari total A
  INSERT INTO vendor_kredit (vendor_induk, supplier_id, jumlah, status, catatan) VALUES (ind, sup2, ta - 1, 'aktif', 'uji');

  -- T4g kredit > total ditolak
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_pur, 'role', 'authenticated')::text, true);
  BEGIN PERFORM ajukan_bayar_po(a.id, NULL, ta + 1); RAISE EXCEPTION 'T4g LOLOS';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- T4b kredit sebagian: kas = 1
  tx := ajukan_bayar_po(a.id, NULL, ta - 1);
  IF (SELECT amount FROM cash_transaction WHERE id = tx) <> 1 THEN RAISE EXCEPTION 'T4b kas'; END IF;
  IF saldo_kredit_vendor(sup2) <> 0 THEN RAISE EXCEPTION 'T4b saldo kredit %', saldo_kredit_vendor(sup2); END IF;

  -- T4d PO kedua tak bisa memakai kredit yang sudah dicadangkan
  BEGIN PERFORM ajukan_bayar_po(b.id, NULL, 1); RAISE EXCEPTION 'T4d LOLOS';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- T4c tolak → cadangan lepas
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  PERFORM tolak_bayar_po(a.id, 'uji tolak');
  IF saldo_kredit_vendor(sup2) <> ta - 1 THEN RAISE EXCEPTION 'T4c kredit tak kembali'; END IF;
  IF (SELECT count(*) FROM vendor_kredit WHERE purchase_order_id = a.id) <> 0 THEN RAISE EXCEPTION 'T4c baris tersisa'; END IF;

  -- T4b' ajukan lagi lalu setujui
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_pur, 'role', 'authenticated')::text, true);
  PERFORM ajukan_bayar_po(a.id, NULL, ta - 1);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  PERFORM setujui_bayar_po(a.id, 'b.jpg', NULL, c_bank);
  IF (SELECT payment_status FROM purchase_order WHERE id = a.id) <> 'paid' THEN RAISE EXCEPTION 'T4b paid'; END IF;
  IF (SELECT count(*) FROM vendor_kredit WHERE purchase_order_id = a.id AND status = 'aktif') <> 1 THEN RAISE EXCEPTION 'T4b aktif'; END IF;
  IF (SELECT dibayar_kredit FROM po_payable_spv WHERE id = a.id) <> ta - 1 THEN RAISE EXCEPTION 'T4b view'; END IF;

  -- T4e kredit penuh: nol transaksi kas, saldo rekening tetap
  INSERT INTO vendor_kredit (vendor_induk, supplier_id, jumlah, status, catatan) VALUES (ind, sup2, tb, 'aktif', 'uji');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_pur, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM cash_transaction WHERE source_id = b.id;
  tx := ajukan_bayar_po(b.id, NULL, tb);
  IF tx IS NOT NULL OR (SELECT count(*) FROM cash_transaction WHERE source_id = b.id) <> n THEN RAISE EXCEPTION 'T4e tx lahir'; END IF;
  IF (SELECT payment_status FROM purchase_order WHERE id = b.id) <> 'pending' THEN RAISE EXCEPTION 'T4e pending'; END IF;
  SELECT saldo INTO s0 FROM cash_balance WHERE cash_location_id = c_bank;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  BEGIN PERFORM setujui_bayar_po(b.id, ' '); RAISE EXCEPTION 'T4e bukti LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Bukti%' THEN RAISE; END IF; END;
  PERFORM setujui_bayar_po(b.id, 'b.jpg');
  SELECT saldo INTO s1 FROM cash_balance WHERE cash_location_id = c_bank;
  IF (SELECT payment_status FROM purchase_order WHERE id = b.id) <> 'paid' OR s1 <> s0 THEN RAISE EXCEPTION 'T4e paid/saldo'; END IF;
  IF (SELECT count(*) FROM approval_log WHERE jenis = 'bayar_vendor' AND sumber_id = b.id AND keputusan = 'setuju') <> 1 THEN RAISE EXCEPTION 'T4e log'; END IF;
  IF saldo_kredit_vendor(sup2) <> 0 THEN RAISE EXCEPTION 'T4e saldo kredit'; END IF;
END $$;

-- T4f kredit lintas supplier dalam satu vendor induk (mis. Pak Aziz Tempo 15 → Tempo 30)
DO $$
DECLARE
  c_pur uuid := (SELECT id FROM outlet_staff WHERE role = 'purchasing' AND status = 'active' ORDER BY id LIMIT 1);
  s1 uuid; s2 uuid; po uuid; t numeric;
BEGIN
  SELECT x.id, y.id INTO s1, s2 FROM supplier x JOIN supplier y ON vendor_induk(x.id) = vendor_induk(y.id) AND x.id <> y.id LIMIT 1;
  IF s1 IS NULL THEN RAISE NOTICE 'T4f dilewati: tidak ada vendor induk bersama'; RETURN; END IF;
  SELECT id INTO po FROM purchase_order WHERE supplier_id = s2 AND status IN ('sebagian_diterima','diterima_lengkap') ORDER BY tanggal_po DESC LIMIT 1;
  IF po IS NULL THEN RAISE NOTICE 'T4f dilewati: tidak ada PO'; RETURN; END IF;
  PERFORM set_config('app.bayar_po', 'on', true);
  UPDATE purchase_order SET payment_status = 'unpaid', cash_transaction_id = NULL, paid_at = NULL WHERE id = po;
  PERFORM set_config('app.bayar_po', 'off', true);
  SELECT sum(subtotal) INTO t FROM purchase_order_item WHERE purchase_order_id = po;
  DELETE FROM vendor_kredit WHERE vendor_induk = vendor_induk(s1);
  INSERT INTO vendor_kredit (vendor_induk, supplier_id, jumlah, status, catatan) VALUES (vendor_induk(s1), s1, t, 'aktif', 'uji');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_pur, 'role', 'authenticated')::text, true);
  PERFORM ajukan_bayar_po(po, NULL, t);
  IF (SELECT count(*) FROM vendor_kredit WHERE purchase_order_id = po AND status = 'dicadangkan') <> 1 THEN RAISE EXCEPTION 'T4f'; END IF;
END $$;
ROLLBACK;
