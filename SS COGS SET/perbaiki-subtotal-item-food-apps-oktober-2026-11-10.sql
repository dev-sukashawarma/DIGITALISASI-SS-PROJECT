-- Perbaikan subtotal item 8 order food apps Oktober 2026 (dijalankan 2026-11-10)
--
-- Masalah: setiap baris order_items di order ini menyimpan subtotal = total SELURUH order
-- (dan sebagian unit_price ikut salah), sehingga jumlah subtotal 2-3x nilai order.
-- View sales_daily_spv lalu membaca selisihnya sebagai potongan dan menggelembungkan
-- omzet kotor di Laba Rugi (Dramaga +318.615, Cibubur +145.000, Sentul +42.502).
-- orders.total_amount, qty, HPP, dan stok TIDAK salah dan tidak disentuh.
--
-- Perbaikan: total_amount order dibagi ke tiap item secara proporsional memakai harga
-- kanal menu (menu_items.channel_prices[kanal] x qty), dibulatkan ke rupiah, sisa
-- pembulatan ke item dengan bobot terbesar. unit_price = subtotal / qty.
-- order_items tidak punya trigger UPDATE (dicek 2026-11-10).
--
-- PEMBALIK (nilai lama):
-- UPDATE order_items SET subtotal = 63000, unit_price = 54000 WHERE id = 'd79e7ec4-3e50-4e18-906e-82c14d52d9dc';
-- UPDATE order_items SET subtotal = 63000, unit_price = 11000 WHERE id = '82afd8a2-157b-4c43-b394-b34fc8fe6252';
-- UPDATE order_items SET subtotal = 63000, unit_price = 9000  WHERE id = '46476496-7ce0-4cc0-98f1-2a5c195bb1c2';
-- UPDATE order_items SET subtotal = 82000, unit_price = 41000 WHERE id IN ('94ea20a7-0438-4ca1-8304-8d04435b629f','82f8e409-03fc-4781-8225-f45716cfa70d','e930ca63-e6d6-4b29-8e94-1a6e86cf22d7');
-- UPDATE order_items SET subtotal = 63000, unit_price = 54000 WHERE id = '32e2ba2d-020f-46cd-8a58-56eb8880c7e2';
-- UPDATE order_items SET subtotal = 63000, unit_price = 11000 WHERE id = '952f21fe-a401-47f2-bae6-7f54c1573256';
-- UPDATE order_items SET subtotal = 72000, unit_price = 72000 WHERE id IN ('57b9b387-e563-4984-abce-7378faebfa70','52050256-4687-4dda-a396-6fed175d6c78');
-- UPDATE order_items SET subtotal = 51000, unit_price = 51000 WHERE id IN ('ae566c34-4525-413c-a540-76fb73eac389','e637083d-1c3e-46dd-b5ea-8c1993b7e87a');
-- UPDATE order_items SET subtotal = 214000, unit_price = 42000 WHERE id = '4bd9cce1-f5e0-4c40-8a5b-db9b369bd568';
-- UPDATE order_items SET subtotal = 214000, unit_price = 54000 WHERE id = '49baaa09-9d42-41d4-aec8-1bbaed5aa4f2';
-- UPDATE order_items SET subtotal = 214000, unit_price = 36000 WHERE id = '6af84c5b-26d7-4ea2-8d55-e975a942a0ea';
-- UPDATE order_items SET subtotal = 76000, unit_price = 42000 WHERE id = '975db173-dd57-4ce4-8109-74335abb70f9';
-- UPDATE order_items SET subtotal = 76000, unit_price = 36000 WHERE id = 'b7d5c66b-8494-4f71-b743-b8cea10923f9';
-- UPDATE order_items SET subtotal = 82000, unit_price = 48000 WHERE id = '2d43aec3-8204-40b1-a452-b3d396317c35';
-- UPDATE order_items SET subtotal = 82000, unit_price = 36000 WHERE id = 'dde0bb0a-216a-4d57-9dba-d7d5cc23b96b';

BEGIN;

DO $$
DECLARE v_rusak int;
BEGIN
  -- Penjaga: ke-8 order masih dalam keadaan rusak (subtotal tiap item = total order).
  SELECT count(*) INTO v_rusak FROM orders o
  WHERE o.id IN ('8e61fb10-fa7b-4970-bee8-bb542cce0a97','e3c008f9-e958-4fb7-9cfc-fc518f9c7d72','46979d19-778f-452a-879f-cb37024c7db7',
                 '41c2a929-893c-487a-a3dc-3cad025e141e','f643f101-1c07-4187-ae29-d9b51625106d','15fd18d6-7a58-4c8e-ae2e-8ec84e8b9a5f',
                 '81343488-f521-42d0-b9df-5cb5969ea42c','b21264a4-b725-4cbb-8e11-b2eec60aad85')
    AND NOT EXISTS (SELECT 1 FROM order_items x WHERE x.order_id = o.id AND x.subtotal <> o.total_amount);
  IF v_rusak <> 8 THEN RAISE EXCEPTION 'ASERSI GAGAL: order rusak = %, harap 8', v_rusak; END IF;
END $$;

WITH ord AS (
  SELECT o.id, o.total_amount, resolve_sales_source(o.channel, o.sales_source) src
  FROM orders o
  WHERE o.id IN ('8e61fb10-fa7b-4970-bee8-bb542cce0a97','e3c008f9-e958-4fb7-9cfc-fc518f9c7d72','46979d19-778f-452a-879f-cb37024c7db7',
                 '41c2a929-893c-487a-a3dc-3cad025e141e','f643f101-1c07-4187-ae29-d9b51625106d','15fd18d6-7a58-4c8e-ae2e-8ec84e8b9a5f',
                 '81343488-f521-42d0-b9df-5cb5969ea42c','b21264a4-b725-4cbb-8e11-b2eec60aad85')
), it AS (
  SELECT o.id order_id, o.total_amount, oi.id item_id, oi.quantity,
         oi.quantity * (m.channel_prices->>o.src)::numeric w
  FROM ord o JOIN order_items oi ON oi.order_id = o.id JOIN menu_items m ON m.id = oi.menu_item_id
), a AS (
  SELECT *, floor(total_amount * w / sum(w) OVER (PARTITION BY order_id)) base,
         row_number() OVER (PARTITION BY order_id ORDER BY w DESC, item_id) rk
  FROM it
), baru AS (
  SELECT item_id, quantity,
         CASE WHEN rk = 1 THEN total_amount - (sum(base) OVER (PARTITION BY order_id) - base) ELSE base END sub
  FROM a
)
UPDATE order_items oi
SET subtotal = b.sub, unit_price = round(b.sub / b.quantity, 2)
FROM baru b WHERE oi.id = b.item_id;

DO $$
DECLARE v_beda int; v_baris int;
BEGIN
  SELECT count(*) INTO v_baris FROM order_items WHERE order_id IN ('8e61fb10-fa7b-4970-bee8-bb542cce0a97','e3c008f9-e958-4fb7-9cfc-fc518f9c7d72','46979d19-778f-452a-879f-cb37024c7db7',
                 '41c2a929-893c-487a-a3dc-3cad025e141e','f643f101-1c07-4187-ae29-d9b51625106d','15fd18d6-7a58-4c8e-ae2e-8ec84e8b9a5f',
                 '81343488-f521-42d0-b9df-5cb5969ea42c','b21264a4-b725-4cbb-8e11-b2eec60aad85');
  IF v_baris <> 19 THEN RAISE EXCEPTION 'ASERSI GAGAL: baris item = %, harap 19', v_baris; END IF;
  -- Setiap order: jumlah subtotal item = total order.
  SELECT count(*) INTO v_beda FROM orders o
  WHERE o.id IN ('8e61fb10-fa7b-4970-bee8-bb542cce0a97','e3c008f9-e958-4fb7-9cfc-fc518f9c7d72','46979d19-778f-452a-879f-cb37024c7db7',
                 '41c2a929-893c-487a-a3dc-3cad025e141e','f643f101-1c07-4187-ae29-d9b51625106d','15fd18d6-7a58-4c8e-ae2e-8ec84e8b9a5f',
                 '81343488-f521-42d0-b9df-5cb5969ea42c','b21264a4-b725-4cbb-8e11-b2eec60aad85')
    AND (SELECT sum(subtotal) FROM order_items x WHERE x.order_id = o.id) <> o.total_amount;
  IF v_beda <> 0 THEN RAISE EXCEPTION 'ASERSI GAGAL: % order jumlah subtotal <> total', v_beda; END IF;
END $$;

COMMIT;
