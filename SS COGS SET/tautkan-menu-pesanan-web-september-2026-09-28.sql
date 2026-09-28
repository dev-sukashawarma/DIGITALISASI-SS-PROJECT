-- ARSIP — SUDAH DIJALANKAN 2026-09-28 (COMMIT). JANGAN DIJALANKAN ULANG.
-- Hasil: 124 baris tertaut (outlet internal 40, mitra 84; 1 baris SHAWARMIE SAPI + AQUA tak cocok); COGS owner Sep 992.025.684 -> 995.349.594; mitra tetap 515.542.265.
-- Pembalikan: tak bisa otomatis (id baris tak disimpan); set menu_item_id NULL untuk baris terkait bila perlu.
-- Tautkan ulang menu_item_id pada baris order_items September 2026 yang kosong (terutama pesanan web),
-- lewat pencocokan nama persis (bagian sebelum '|NOTE|'), abaikan kategori "Voucher Pamulang 10%"
-- (nama kembar), dan hanya bila cocok ke TEPAT SATU menu. Stok TIDAK dipotong mundur.
-- order_items hanya punya trigger AFTER INSERT, jadi UPDATE ini tak memicu apa pun.
BEGIN;
CREATE TEMP TABLE _kandidat AS
SELECT oi.id AS item_id, trim(split_part(oi.menu_item_name, '|', 1)) AS nama, ot.name AS outlet, ot.type,
       (SELECT array_agg(m.id) FROM menu_items m LEFT JOIN categories c ON c.id = m.category_id
         WHERE lower(btrim(m.name)) = lower(trim(split_part(oi.menu_item_name, '|', 1)))
           AND COALESCE(c.name, '') <> 'Voucher Pamulang 10%') AS cocok
FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN outlets ot ON ot.id = o.outlet_id
WHERE oi.menu_item_id IS NULL
  AND o.created_at >= '2026-09-01 00:00+07' AND o.created_at < '2026-10-01 00:00+07'
  AND ot.type NOT IN ('test', 'marketplace');

CREATE TEMP TABLE _cek (tahap text, owner_cogs numeric, mitra_cogs numeric);
INSERT INTO _cek SELECT 'sebelum',
  (get_owner_dashboard_summary(timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-30 23:59:59.999+07') ->> 'total_cogs')::numeric,
  (SELECT sum(cogs) FROM get_mitra_orders_summary((SELECT array_agg(id) FROM outlets WHERE type='mitra'), timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-30 23:59:59.999+07'));

UPDATE order_items oi SET menu_item_id = k.cocok[1]
FROM _kandidat k WHERE oi.id = k.item_id AND cardinality(k.cocok) = 1 AND oi.menu_item_id IS NULL;

INSERT INTO _cek SELECT 'sesudah',
  (get_owner_dashboard_summary(timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-30 23:59:59.999+07') ->> 'total_cogs')::numeric,
  (SELECT sum(cogs) FROM get_mitra_orders_summary((SELECT array_agg(id) FROM outlets WHERE type='mitra'), timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-30 23:59:59.999+07'));

SELECT 'COGS ' || tahap || ' | owner ' || round(owner_cogs) || ' | mitra ' || round(mitra_cogs) AS baris FROM _cek
UNION ALL
SELECT 'TERTAUT | ' || type || ' | ' || nama || ' | ' || count(*) FROM _kandidat WHERE cardinality(cocok) = 1 GROUP BY type, nama
UNION ALL
SELECT 'TIDAK | ' || type || ' | ' || nama || ' | cocok=' || COALESCE(cardinality(cocok), 0) || ' | ' || count(*) FROM _kandidat WHERE COALESCE(cardinality(cocok), 0) <> 1 GROUP BY type, nama, cocok
ORDER BY 1;
ROLLBACK;
