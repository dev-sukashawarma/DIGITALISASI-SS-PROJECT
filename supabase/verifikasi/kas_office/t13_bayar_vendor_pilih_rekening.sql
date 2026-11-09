-- Uji 20261109180000: setujui pembayaran vendor dengan memilih rekening. Berakhir ROLLBACK.
-- Penanda keberhasilan: 'KONTROL: T13 ...'.
BEGIN;
DO $$
DECLARE
  c_fin  uuid := '7fa90a19-3951-426f-b088-30cc536cffad';   -- admin_finance aktif
  c_pcb  uuid := 'b0955381-0040-4c0e-9a11-5e70a0000002';   -- Rekening Petty Cash Bank
  c_pct  uuid := 'b0000000-0ff1-4c0e-9a11-5e70a0000003';   -- Rekening Petty Cash Tunai
  c_lama uuid := '0c116d5f-f147-4eff-9bc2-ce9d549e2869';   -- rekening lama nonaktif
  c_pur uuid; v_po uuid; v_po2 uuid; v_asal uuid; v_total numeric;
  a0 numeric; a1 numeric; p0 numeric; p1 numeric; r record;
BEGIN
  SELECT id INTO c_pur FROM outlet_staff WHERE role = 'purchasing' AND status = 'active' LIMIT 1;
  SELECT po.id INTO v_po FROM purchase_order po WHERE po.status IN ('sebagian_diterima','diterima_lengkap') AND po.payment_status = 'unpaid'
     AND EXISTS (SELECT 1 FROM purchase_order_item i WHERE i.purchase_order_id = po.id AND i.subtotal > 0) ORDER BY po.created_at DESC LIMIT 1;
  SELECT po.id INTO v_po2 FROM purchase_order po WHERE po.status IN ('sebagian_diterima','diterima_lengkap') AND po.payment_status = 'unpaid' AND po.id <> v_po
     AND EXISTS (SELECT 1 FROM purchase_order_item i WHERE i.purchase_order_id = po.id AND i.subtotal > 0) ORDER BY po.created_at DESC LIMIT 1;
  SELECT sum(subtotal) INTO v_total FROM purchase_order_item WHERE purchase_order_id = v_po;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_pur, 'role', 'authenticated')::text, true);
  PERFORM ajukan_bayar_po(v_po, NULL);
  PERFORM ajukan_bayar_po(v_po2, NULL);
  SELECT cash_location_id INTO v_asal FROM cash_transaction
   WHERE id = (SELECT cash_transaction_id FROM purchase_order WHERE id = v_po);
  IF v_asal = c_pcb THEN RAISE EXCEPTION 'T13: fixture — rekening pengajuan sudah Petty Cash Bank'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);

  -- (a) rekening lama / nonaktif ditolak
  BEGIN PERFORM setujui_bayar_po(v_po, 'b.jpg', NULL, c_lama); RAISE EXCEPTION 'T13a LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%rekening pusat yang aktif%' THEN RAISE; END IF; END;

  -- (b) tunai melebihi saldo ditolak
  IF coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = c_pct), 0) < v_total THEN
    BEGIN PERFORM setujui_bayar_po(v_po, 'b.jpg', NULL, c_pct); RAISE EXCEPTION 'T13b LOLOS';
    EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%tidak mencukupi%' THEN RAISE; END IF; END;
  END IF;

  -- (c) pilih Petty Cash Bank: yang terpotong Petty Cash Bank, rekening pengajuan utuh
  SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = v_asal), 0) INTO a0;
  SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = c_pcb), 0) INTO p0;
  PERFORM setujui_bayar_po(v_po, 'b.jpg', 'transfer dari PC', c_pcb);
  SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = v_asal), 0) INTO a1;
  SELECT saldo INTO p1 FROM cash_balance WHERE cash_location_id = c_pcb;
  IF a1 <> a0 THEN RAISE EXCEPTION 'T13c: rekening pengajuan bergeser %', a1 - a0; END IF;
  IF p1 <> p0 - v_total THEN RAISE EXCEPTION 'T13c: Petty Cash Bank % harap %', p1 - p0, -v_total; END IF;
  SELECT po.payment_status, po.cash_location_id, t.cash_location_id AS tx_lok, t.status INTO r
    FROM purchase_order po JOIN cash_transaction t ON t.id = po.cash_transaction_id WHERE po.id = v_po;
  IF r.payment_status <> 'paid' OR r.cash_location_id <> c_pcb OR r.tx_lok <> c_pcb OR r.status <> 'paid' THEN
    RAISE EXCEPTION 'T13c: baris %', r;
  END IF;

  -- (d) tanpa pilihan = tetap rekening pengajuan (perilaku lama)
  SELECT cash_location_id INTO v_asal FROM cash_transaction
   WHERE id = (SELECT cash_transaction_id FROM purchase_order WHERE id = v_po2);
  SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = v_asal), 0) INTO a0;
  PERFORM setujui_bayar_po(p_po_id := v_po2, p_proof_url := 'b.jpg', p_catatan := NULL);
  SELECT saldo INTO a1 FROM cash_balance WHERE cash_location_id = v_asal;
  IF a1 <> a0 - (SELECT sum(subtotal) FROM purchase_order_item WHERE purchase_order_id = v_po2) THEN
    RAISE EXCEPTION 'T13d: rekening pengajuan tidak terpotong';
  END IF;

  RAISE EXCEPTION 'KONTROL: T13 semua asersi lolos (sengaja dilempar)';
END $$;
ROLLBACK;
