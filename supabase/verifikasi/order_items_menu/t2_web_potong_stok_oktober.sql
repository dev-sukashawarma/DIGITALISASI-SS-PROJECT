-- Uji migration 20260928210000: pesanan web memotong stok mulai 1 Okt 2026 WIB.
-- Semua di dalam transaksi + ROLLBACK. Kontrol negatif: tanpa migration kasus W harus GAGAL
-- (pesanan web Oktober tetap nol baris ledger).
BEGIN;
DO $$
DECLARE
  v_outlet uuid; v_menu uuid;
  v_w uuid; v_w0 uuid; v_p uuid; v_k uuid;
  n_w int; n_w0 int; n_p int; n_k int;
BEGIN
  -- outlet internal ber-BOM aktif + menu ber-resep
  SELECT id INTO v_outlet FROM outlets WHERE name = 'SUKA SHAWARMA EMPANG' AND is_bom_enabled;
  SELECT m.id INTO v_menu FROM menu_items m JOIN categories c ON c.id = m.category_id
   WHERE m.name = 'Original Ayam Jumbo' AND c.name = 'Original Shawarma Ayam';
  IF v_outlet IS NULL OR v_menu IS NULL THEN RAISE EXCEPTION 'fixture tidak lengkap'; END IF;

  -- W: web, dibuat 2 Okt -> WAJIB memotong stok
  INSERT INTO orders (outlet_id, customer_name, status, payment_method, total_amount, source, sales_source, external_order_id, created_at)
  VALUES (v_outlet, 'uji-w', 'preparing', 'qris', 1, 'online', 'online', gen_random_uuid()::text, timestamptz '2026-10-02 12:00+07') RETURNING id INTO v_w;
  -- W0: web, dibuat 27 Sep -> tidak memotong
  INSERT INTO orders (outlet_id, customer_name, status, payment_method, total_amount, source, sales_source, external_order_id, created_at)
  VALUES (v_outlet, 'uji-w0', 'preparing', 'qris', 1, 'online', 'online', gen_random_uuid()::text, timestamptz '2026-09-27 12:00+07') RETURNING id INTO v_w0;
  -- P: impor external non-web (seperti Pawoon), dibuat 2 Okt -> tidak memotong
  INSERT INTO orders (outlet_id, customer_name, status, payment_method, total_amount, source, sales_source, external_order_id, created_at)
  VALUES (v_outlet, 'uji-p', 'preparing', 'cash', 1, 'pos', 'pos', 'UJIPWN', timestamptz '2026-10-02 12:00+07') RETURNING id INTO v_p;
  -- K: pesanan kasir biasa (tanpa external) -> tetap memotong (regresi)
  INSERT INTO orders (outlet_id, customer_name, status, payment_method, total_amount, source, sales_source)
  VALUES (v_outlet, 'uji-k', 'preparing', 'cash', 1, 'pos', 'pos') RETURNING id INTO v_k;

  INSERT INTO order_items (order_id, menu_item_id, menu_item_name, quantity, unit_price, subtotal)
  SELECT x, v_menu, 'Original Ayam Jumbo', 1, 1, 1 FROM unnest(ARRAY[v_w, v_w0, v_p, v_k]) x;
  UPDATE orders SET status = 'completed' WHERE id IN (v_w, v_w0, v_p, v_k);

  SELECT count(*) INTO n_w  FROM ledger_stok WHERE ref_order_id = v_w  AND tipe = 'pemakaian';
  SELECT count(*) INTO n_w0 FROM ledger_stok WHERE ref_order_id = v_w0 AND tipe = 'pemakaian';
  SELECT count(*) INTO n_p  FROM ledger_stok WHERE ref_order_id = v_p  AND tipe = 'pemakaian';
  SELECT count(*) INTO n_k  FROM ledger_stok WHERE ref_order_id = v_k  AND tipe = 'pemakaian';
  RAISE NOTICE 'W=% W0=% P=% K=%', n_w, n_w0, n_p, n_k;
  IF n_k = 0  THEN RAISE EXCEPTION 'K GAGAL: pesanan kasir tidak memotong stok (fixture/BOM bermasalah)'; END IF;
  IF n_w = 0  THEN RAISE EXCEPTION 'W GAGAL: pesanan web Oktober tidak memotong stok'; END IF;
  IF n_w0 <> 0 THEN RAISE EXCEPTION 'W0 GAGAL: pesanan web September ikut memotong stok'; END IF;
  IF n_p <> 0 THEN RAISE EXCEPTION 'P GAGAL: impor external non-web ikut memotong stok'; END IF;
END $$;
SELECT 'LULUS' AS hasil;
ROLLBACK;
