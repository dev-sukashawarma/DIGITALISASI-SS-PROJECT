-- Uji trg_order_items_isi_menu_dari_nama (migration 20260928200000).
-- Jalankan SETELAH migration terpasang. Semua di dalam transaksi + ROLLBACK (nol perubahan nyata).
-- Kontrol negatif: sebelum apply, berkas ini dijalankan dengan migration disisipkan di tengah;
-- kasus K (trigger dimatikan) membuktikan tanpa penjaga baris web memang masuk ber-id NULL.
BEGIN;
DO $$
DECLARE
  v_outlet uuid; v_web uuid; v_pos uuid;
  v_ayam uuid; v_keju uuid;
  n int;
BEGIN
  SELECT id INTO v_outlet FROM outlets WHERE type = 'test' LIMIT 1;
  SELECT m.id INTO v_ayam FROM menu_items m JOIN categories c ON c.id = m.category_id
   WHERE m.name = 'Original Ayam Jumbo' AND c.name = 'Original Shawarma Ayam';
  SELECT m.id INTO v_keju FROM menu_items m JOIN categories c ON c.id = m.category_id
   WHERE m.name = 'Extra Keju' AND c.name = 'Topping';
  IF v_outlet IS NULL OR v_ayam IS NULL OR v_keju IS NULL THEN RAISE EXCEPTION 'fixture tidak lengkap'; END IF;

  INSERT INTO orders (outlet_id, customer_name, status, payment_method, total_amount, source, sales_source)
  VALUES (v_outlet, 'uji-trigger-web', 'preparing', 'qris', 1, 'online', 'online') RETURNING id INTO v_web;
  INSERT INTO orders (outlet_id, customer_name, status, payment_method, total_amount, source, sales_source)
  VALUES (v_outlet, 'uji-trigger-pos', 'preparing', 'cash', 1, 'pos', 'pos') RETURNING id INTO v_pos;

  -- K. kontrol negatif: trigger dimatikan -> tetap NULL
  ALTER TABLE order_items DISABLE TRIGGER trg_order_items_isi_menu_dari_nama;
  INSERT INTO order_items (order_id, menu_item_name, quantity, unit_price, subtotal) VALUES (v_web, 'K|Original Ayam Jumbo', 1, 1, 1);
  INSERT INTO order_items (order_id, menu_item_name, quantity, unit_price, subtotal) VALUES (v_web, 'Original Ayam Besar', 1, 1, 1);
  IF (SELECT menu_item_id FROM order_items WHERE order_id = v_web AND menu_item_name = 'Original Ayam Besar') IS NOT NULL THEN
    RAISE EXCEPTION 'K GAGAL: tanpa penjaga id seharusnya NULL';
  END IF;
  DELETE FROM order_items WHERE order_id = v_web;
  ALTER TABLE order_items ENABLE TRIGGER trg_order_items_isi_menu_dari_nama;

  INSERT INTO order_items (order_id, menu_item_id, menu_item_name, quantity, unit_price, subtotal) VALUES
    (v_web, NULL,   'Original Ayam Jumbo', 1, 1, 1),                 -- B: nama kembar dgn Voucher Pamulang -> menu biasa
    (v_web, NULL,   'original ayam jumbo |NOTE|Tidak pedas', 1, 1, 1), -- C: huruf kecil, spasi, metadata
    (v_web, NULL,   'Menu Tidak Ada', 1, 1, 1),                      -- D: tak dikenal -> tetap NULL
    (v_web, v_keju, 'Original Ayam Jumbo', 1, 1, 1);                 -- E: id eksplisit tak ditimpa
  INSERT INTO order_items (order_id, menu_item_id, menu_item_name, quantity, unit_price, subtotal) VALUES
    (v_pos, NULL,   'Original Ayam Jumbo', 1, 1, 1);                 -- F: pesanan kasir tak disentuh

  SELECT count(*) INTO n FROM order_items WHERE order_id = v_web AND menu_item_id = v_ayam;
  IF n <> 2 THEN RAISE EXCEPTION 'B/C GAGAL: % baris terisi Original Ayam Jumbo (harus 2)', n; END IF;
  IF (SELECT menu_item_id FROM order_items WHERE order_id = v_web AND menu_item_name = 'Menu Tidak Ada') IS NOT NULL THEN
    RAISE EXCEPTION 'D GAGAL: nama tak dikenal ikut terisi';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = v_web AND menu_item_id = v_keju) THEN
    RAISE EXCEPTION 'E GAGAL: id eksplisit tertimpa';
  END IF;
  IF (SELECT menu_item_id FROM order_items WHERE order_id = v_pos) IS NOT NULL THEN
    RAISE EXCEPTION 'F GAGAL: pesanan kasir ikut diisi';
  END IF;
  RAISE NOTICE 'LULUS: K, B, C, D, E, F';
END $$;
SELECT 'LULUS' AS hasil;
ROLLBACK;
