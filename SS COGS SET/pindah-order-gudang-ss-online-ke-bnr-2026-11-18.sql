-- ARSIP — SUDAH DIJALANKAN 2026-11-18 (keputusan owner: "masukin ke BNR", "kembalikan karena
-- Gudang SS Online bukan Outlet"). Jangan diulang (ada penjaga SUDAH PERNAH DIJALANKAN).
--
-- Pesanan website GUD-021026-001 (2 Okt 2026 20:57 WIB, syamsul triono, 3 Original Sapi Sedang,
-- Rp 81.486, QRIS) masuk ke GUDANG SS ONLINE karena outlet itu masih tampil sebagai pilihan
-- outlet di website Order Online (dibuat 29 Sep untuk uji coba). Kasir tak tercatat di mana pun.
-- Koreksi: pesanan → BNR #34 (nomor #1 bentrok dengan BNR #1 hari itu), xendit_pembayaran ikut,
-- 13 potongan bahan dikembalikan ke Gudang SS Online (adjustment, ref_order_id sama → bersih 0).
-- Ledger BNR sengaja tidak ditambah: opname BNR sejak Oktober sudah menyerap pemakaian itu.
-- Hasil: saldo gudang kembali bulat (SAPI 32.000, KENTANG 35.500, MAYONAISE 18.000, KULIT 25 268).
--
-- Pembalik:
--   adjustment pembalik (qty negatif) untuk 13 baris adjustment ber-ref_order_id di bawah,
--   UPDATE xendit_pembayaran SET outlet_id='d23e11b3-23f1-4f9a-b428-cc73e1aa9b91' WHERE external_order_id='dfee03f9-03a2-4e9f-89f2-7cd5510c7ed9';
--   UPDATE orders SET outlet_id='d23e11b3-23f1-4f9a-b428-cc73e1aa9b91', order_number=1 WHERE id='545ba945-6cda-4353-ba57-6e284c2d578d';
--   (jangan UPDATE stok_balance langsung.)

DO $$
DECLARE
  v_order constant uuid := '545ba945-6cda-4353-ba57-6e284c2d578d';
  v_gudang constant uuid := 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91';
  v_bnr constant uuid := '550e8400-e29b-41d4-a716-446655440001';
  nomor int; n_order int; n_x int; n_adj int; sisa numeric; bnr0 int; bnr1 int;
BEGIN
  IF EXISTS (SELECT 1 FROM ledger_stok WHERE ref_order_id=v_order AND tipe='adjustment') THEN
    RAISE EXCEPTION 'SUDAH PERNAH DIJALANKAN';
  END IF;
  SELECT count(*) INTO bnr0 FROM ledger_stok WHERE outlet_id=v_bnr;
  SELECT max(order_number)+1 INTO nomor FROM orders WHERE outlet_id=v_bnr AND (created_at AT TIME ZONE 'Asia/Jakarta')::date='2026-10-02';

  UPDATE orders SET outlet_id=v_bnr, order_number=nomor
   WHERE id=v_order AND outlet_id=v_gudang AND external_order_id='dfee03f9-03a2-4e9f-89f2-7cd5510c7ed9' AND total_amount=81486;
  GET DIAGNOSTICS n_order = ROW_COUNT;

  UPDATE xendit_pembayaran SET outlet_id=v_bnr WHERE external_order_id='dfee03f9-03a2-4e9f-89f2-7cd5510c7ed9' AND outlet_id=v_gudang;
  GET DIAGNOSTICS n_x = ROW_COUNT;

  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id)
  SELECT v_gudang, bahan_baku_id, 'adjustment', -qty,
         'Koreksi 18 Nov 2026: pesanan website 2 Okt (syamsul triono) dilayani BNR, bukan Gudang SS Online — potongan dikembalikan', v_order
  FROM ledger_stok WHERE ref_order_id=v_order AND outlet_id=v_gudang AND tipe='pemakaian';
  GET DIAGNOSTICS n_adj = ROW_COUNT;

  SELECT coalesce(sum(abs(t.s)),0) INTO sisa FROM (SELECT bahan_baku_id, sum(qty) s FROM ledger_stok WHERE ref_order_id=v_order AND outlet_id=v_gudang GROUP BY 1) t;
  SELECT count(*) INTO bnr1 FROM ledger_stok WHERE outlet_id=v_bnr;

  IF n_order<>1 THEN RAISE EXCEPTION 'ASERSI GAGAL: order %', n_order; END IF;
  IF n_x<>1 THEN RAISE EXCEPTION 'ASERSI GAGAL: xendit %', n_x; END IF;
  IF n_adj<>13 THEN RAISE EXCEPTION 'ASERSI GAGAL: adjustment %', n_adj; END IF;
  IF sisa > 1e-9 THEN RAISE EXCEPTION 'ASERSI GAGAL: sisa potongan gudang %', sisa; END IF;
  IF bnr1<>bnr0 THEN RAISE EXCEPTION 'ASERSI GAGAL: ledger BNR % -> %', bnr0, bnr1; END IF;
END $$;
