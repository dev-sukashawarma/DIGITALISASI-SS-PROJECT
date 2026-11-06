-- Uji 20261106150000: ajukan -> setujui / tolak pembayaran vendor + penjaga kolom bayar PO.
-- Berakhir ROLLBACK. Penanda keberhasilan: 'KONTROL: T11 ...'.
BEGIN;
DO $$
DECLARE
  c_fin  uuid := '7fa90a19-3951-426f-b088-30cc536cffad';   -- admin_finance aktif
  c_crew uuid := '50151804-ff12-4ef3-bbac-f2129ff2e05c';   -- crew aktif
  c_bb   uuid := 'b0955353-1240-4c0e-9a11-5e70a0000004';   -- Rekening Bahan Baku Bank
  c_pur  uuid; v_po uuid; v_po2 uuid; v_tx uuid; v_total numeric; s0 numeric; s1 numeric; r record;
BEGIN
  SELECT id INTO c_pur FROM outlet_staff WHERE role = 'purchasing' AND status = 'active' LIMIT 1;
  IF c_pur IS NULL THEN RAISE EXCEPTION 'T11: fixture purchasing tidak ada'; END IF;
  SELECT po.id INTO v_po FROM purchase_order po
   WHERE po.status IN ('sebagian_diterima','diterima_lengkap') AND po.payment_status = 'unpaid'
     AND EXISTS (SELECT 1 FROM purchase_order_item i WHERE i.purchase_order_id = po.id AND i.subtotal > 0)
   ORDER BY po.created_at DESC LIMIT 1;
  SELECT po.id INTO v_po2 FROM purchase_order po
   WHERE po.status IN ('sebagian_diterima','diterima_lengkap') AND po.payment_status = 'unpaid' AND po.id <> v_po
     AND EXISTS (SELECT 1 FROM purchase_order_item i WHERE i.purchase_order_id = po.id AND i.subtotal > 0)
   ORDER BY po.created_at DESC LIMIT 1;
  SELECT sum(subtotal) INTO v_total FROM purchase_order_item WHERE purchase_order_id = v_po;
  SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = c_bb), 0) INTO s0;

  -- (a) crew tidak boleh mengajukan
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_crew, 'role', 'authenticated')::text, true);
  BEGIN PERFORM ajukan_bayar_po(v_po, NULL); RAISE EXCEPTION 'T11a LOLOS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- (b) purchasing mengajukan -> pending, saldo belum bergerak
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_pur, 'role', 'authenticated')::text, true);
  v_tx := ajukan_bayar_po(v_po, 'tagihan minggu ini');
  SELECT payment_status, cash_transaction_id INTO r FROM purchase_order WHERE id = v_po;
  IF r.payment_status <> 'pending' OR r.cash_transaction_id IS DISTINCT FROM v_tx THEN RAISE EXCEPTION 'T11b: PO %', r; END IF;
  SELECT saldo INTO s1 FROM cash_balance WHERE cash_location_id = c_bb;
  IF s1 <> s0 THEN RAISE EXCEPTION 'T11b: saldo bergerak %', s1 - s0; END IF;
  IF (SELECT cash_location_id FROM cash_transaction WHERE id = v_tx) <> c_bb THEN RAISE EXCEPTION 'T11b: rekening salah'; END IF;

  -- (c) ajukan ulang ditolak; purchasing tak boleh setujui; ubah langsung kolom bayar ditolak
  BEGIN PERFORM ajukan_bayar_po(v_po, NULL); RAISE EXCEPTION 'T11c1 LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%sudah diajukan%' THEN RAISE; END IF; END;
  BEGIN PERFORM setujui_bayar_po(v_po, 'bukti.jpg', NULL); RAISE EXCEPTION 'T11c2 LOLOS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE purchase_order SET payment_status = 'paid' WHERE id = v_po2; RAISE EXCEPTION 'T11c3 LOLOS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- (d) admin finance: tanpa bukti ditolak, lalu setujui -> saldo turun, PO lunas
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  BEGIN PERFORM setujui_bayar_po(v_po, ' ', NULL); RAISE EXCEPTION 'T11d1 LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Bukti%' THEN RAISE; END IF; END;
  PERFORM setujui_bayar_po(v_po, 'bukti.jpg', 'transfer BCA');
  SELECT payment_status, paid_at, paid_amount INTO r FROM purchase_order WHERE id = v_po;
  IF r.payment_status <> 'paid' OR r.paid_at IS NULL OR r.paid_amount <> v_total THEN RAISE EXCEPTION 'T11d: PO %', r; END IF;
  SELECT saldo INTO s1 FROM cash_balance WHERE cash_location_id = c_bb;
  IF s1 <> s0 - v_total THEN RAISE EXCEPTION 'T11d: saldo % harap %', s1 - s0, -v_total; END IF;
  IF (SELECT status FROM cash_transaction WHERE id = v_tx) <> 'paid' THEN RAISE EXCEPTION 'T11d: tx bukan paid'; END IF;
  -- (d2) admin finance pun tak boleh mengubah kolom bayar PO langsung (penanda RPC sudah dimatikan)
  BEGIN UPDATE purchase_order SET paid_at = now() - interval '1 day' WHERE id = v_po; RAISE EXCEPTION 'T11d2 LOLOS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- (e) tolak: PO kedua diajukan lalu ditolak -> unpaid lagi, saldo tetap
  PERFORM ajukan_bayar_po(v_po2, NULL);
  BEGIN PERFORM tolak_bayar_po(v_po2, ''); RAISE EXCEPTION 'T11e1 LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Alasan%' THEN RAISE; END IF; END;
  PERFORM tolak_bayar_po(v_po2, 'nominal tagihan beda');
  SELECT payment_status, cash_transaction_id INTO r FROM purchase_order WHERE id = v_po2;
  IF r.payment_status <> 'unpaid' OR r.cash_transaction_id IS NOT NULL THEN RAISE EXCEPTION 'T11e: PO %', r; END IF;
  SELECT saldo INTO s1 FROM cash_balance WHERE cash_location_id = c_bb;
  IF s1 <> s0 - v_total THEN RAISE EXCEPTION 'T11e: saldo bergeser'; END IF;

  RAISE EXCEPTION 'KONTROL: T11 semua asersi lolos (sengaja dilempar)';
END $$;
ROLLBACK;
