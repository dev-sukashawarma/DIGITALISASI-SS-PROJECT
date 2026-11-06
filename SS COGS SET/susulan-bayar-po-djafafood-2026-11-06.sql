-- ARSIP (sudah dijalankan 6 Nov 2026, jangan diulang).
-- PO/KITCHEN/20261106/0002 (Djafafood, Rp 6.500.000) ditandai lunas manual pukul 15:29 WIB,
-- sebelum alur approval pembayaran vendor live, jadi saldo Rekening Bahan Baku Bank tidak terpotong.
-- Dananya masuk lewat Transfer dari Rekening Utama Rp 6.500.000 pukul 15:10 WIB.
-- Dua PO Djafafood 3 Nov (Rp 21.000.000 & Rp 5.200.000) SENGAJA tidak dicatat: dibayar sebelum
-- saldo awal 5 Nov, jadi sudah termasuk di saldo awal. PO Toko Zein 0004 (Rp 744.000) menunggu
-- konfirmasi rekening sumber.
BEGIN;
DO $$
DECLARE
  c_po  uuid := '8b40dc1a-0f9d-4288-8e27-270bcf5eaee6';
  c_bb  uuid := 'b0955353-1240-4c0e-9a11-5e70a0000004';
  s0 numeric; s1 numeric; v_tx uuid; r record;
BEGIN
  SELECT nomor_po, payment_status, cash_transaction_id INTO r FROM purchase_order WHERE id = c_po FOR UPDATE;
  IF r.nomor_po <> 'PO/KITCHEN/20261106/0002' OR r.payment_status <> 'paid' OR r.cash_transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'Keadaan PO tidak sesuai: %', r;
  END IF;
  IF (SELECT sum(subtotal) FROM purchase_order_item WHERE purchase_order_id = c_po) <> 6500000 THEN
    RAISE EXCEPTION 'Total PO bukan 6.500.000';
  END IF;
  SELECT saldo INTO s0 FROM cash_balance WHERE cash_location_id = c_bb;

  INSERT INTO cash_transaction (cash_location_id, direction, amount, category, source_type, source_id,
    note, status, occurred_at)
  VALUES (c_bb, 'out', 6500000, 'Bayar PO PO/KITCHEN/20261106/0002 · Djafafood', 'supplier_po', c_po,
    'Susulan: dibayar sebelum alur approval pembayaran vendor (ditandai lunas manual 6 Nov 15:29)',
    'paid', '2026-11-06 15:29:27+07')
  RETURNING id INTO v_tx;

  UPDATE purchase_order SET cash_transaction_id = v_tx WHERE id = c_po;

  SELECT saldo INTO s1 FROM cash_balance WHERE cash_location_id = c_bb;
  IF s1 <> s0 - 6500000 THEN RAISE EXCEPTION 'Saldo bergeser %, harap -6.500.000', s1 - s0; END IF;
  IF (SELECT payment_status FROM purchase_order WHERE id = c_po) <> 'paid' THEN RAISE EXCEPTION 'PO berubah status'; END IF;
END $$;
COMMIT;
