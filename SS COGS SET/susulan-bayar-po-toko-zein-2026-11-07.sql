-- ARSIP (sudah dijalankan 7 Nov 2026, jangan diulang).
-- PO/KITCHEN/20261106/0004 (Toko Zein, Rp 744.000) ditandai lunas manual 6 Nov 13:40 WIB,
-- sebelum alur approval pembayaran vendor live, jadi saldo rekening tidak terpotong.
-- Sumber dana: Rekening Bahan Baku Bank (konfirmasi owner 7 Nov).
BEGIN;
DO $$
DECLARE
  c_po  uuid := '4ee36945-4be5-443c-8cc3-63700fd67380';
  c_bb  uuid := 'b0955353-1240-4c0e-9a11-5e70a0000004';
  s0 numeric; s1 numeric; v_tx uuid; r record;
BEGIN
  SELECT nomor_po, payment_status, cash_transaction_id INTO r FROM purchase_order WHERE id = c_po FOR UPDATE;
  IF r.nomor_po <> 'PO/KITCHEN/20261106/0004' OR r.payment_status <> 'paid' OR r.cash_transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'Keadaan PO tidak sesuai: %', r;
  END IF;
  IF (SELECT sum(subtotal) FROM purchase_order_item WHERE purchase_order_id = c_po) <> 744000 THEN
    RAISE EXCEPTION 'Total PO bukan 744.000';
  END IF;
  SELECT saldo INTO s0 FROM cash_balance WHERE cash_location_id = c_bb;

  INSERT INTO cash_transaction (cash_location_id, direction, amount, category, source_type, source_id,
    note, status, occurred_at)
  VALUES (c_bb, 'out', 744000, 'Bayar PO PO/KITCHEN/20261106/0004 · Toko Zein', 'supplier_po', c_po,
    'Susulan: dibayar sebelum alur approval pembayaran vendor (ditandai lunas manual 6 Nov 13:40)',
    'paid', '2026-11-06 13:40:38+07')
  RETURNING id INTO v_tx;

  UPDATE purchase_order SET cash_transaction_id = v_tx WHERE id = c_po;

  SELECT saldo INTO s1 FROM cash_balance WHERE cash_location_id = c_bb;
  IF s1 <> s0 - 744000 THEN RAISE EXCEPTION 'Saldo bergeser %, harap -744.000', s1 - s0; END IF;
  IF (SELECT payment_status FROM purchase_order WHERE id = c_po) <> 'paid' THEN RAISE EXCEPTION 'PO berubah status'; END IF;
END $$;
COMMIT;
