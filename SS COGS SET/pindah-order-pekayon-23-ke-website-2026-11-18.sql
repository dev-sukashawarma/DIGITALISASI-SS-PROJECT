-- ARSIP — SUDAH DIJALANKAN 2026-11-18 (atas permintaan owner: "samakan" dengan Xendit). Jangan diulang.
--
-- Pesanan #23 MITRA PEKAYON (9 Okt 2026 19:17 WIB, Rp 100.600, QRIS) dibayar lewat Xendit
-- (pesanan website / Order Online, external_order_id UUID) tetapi tercatat sales_source='pos',
-- sehingga tidak masuk filter Website di Rangkuman Penjualan.
-- Sesudah koreksi: pesanan website selesai Oktober = 126 / Rp 8.511.868 = pembayaran Xendit Oktober.
-- Baris ledger_stok pesanan ini tidak berubah (14 sebelum & sesudah).
--
-- Pembalik: UPDATE orders SET sales_source='pos' WHERE id='1eed23dd-83a1-4f0e-bc03-e6790370f043';

DO $$
DECLARE n int; l0 int; l1 int;
BEGIN
  SELECT count(*) INTO l0 FROM ledger_stok WHERE ref_order_id='1eed23dd-83a1-4f0e-bc03-e6790370f043';
  UPDATE orders SET sales_source='online'
   WHERE id='1eed23dd-83a1-4f0e-bc03-e6790370f043' AND sales_source='pos'
     AND external_order_id='7e06c3da-3351-4d24-b3df-58c8a2ee3fde' AND total_amount=100600;
  GET DIAGNOSTICS n = ROW_COUNT;
  SELECT count(*) INTO l1 FROM ledger_stok WHERE ref_order_id='1eed23dd-83a1-4f0e-bc03-e6790370f043';
  IF n <> 1 THEN RAISE EXCEPTION 'ASERSI GAGAL: % baris berubah', n; END IF;
  IF l1 <> l0 THEN RAISE EXCEPTION 'ASERSI GAGAL: ledger % -> %', l0, l1; END IF;
END $$;
