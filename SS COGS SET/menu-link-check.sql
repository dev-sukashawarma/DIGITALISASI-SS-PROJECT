-- menu-link-check.sql
-- Cek pemetaan 20 nama produk COGS -> menu_items.name (untuk isi resep.menu_item_ref).
-- Read-only. Jalankan di SQL editor Supabase (butuh akses baca menu_items).
-- menu_items bisa banyak baris per nama (satu per outlet). resep scope=global pilih 1.

WITH produk(nama) AS (
  VALUES
  ('Shawarma Ayam Sedang'),
  ('Shawarma Ayam Besar'),
  ('Shawarma Ayam Jumbo'),
  ('Shawarma Mix Besar'),
  ('Shawarma Mix Jumbo'),
  ('Shawarma Sapi Sedang'),
  ('Shawarma Sapi Besar'),
  ('Shawarma Sapi Jumbo'),
  ('Shawarmie Ayam'),
  ('Shawarmie Sapi'),
  ('Suka Drink'),
  ('Shawarma Subsidi'),
  ('Ayam Sedang Subsidi'),
  ('Shawarma Online Reguler'),
  ('Shawarma Online Reguler Sapi'),
  ('Shawarma Online Reguler Mix'),
  ('Suka Beef'),
  ('Suka Chicken'),
  ('Suka Fried Chicken'),
  ('Suka Samyang')
)
-- 1) Ringkasan match (case-insensitive, trim)
SELECT
  p.nama AS produk_cogs,
  COUNT(m.id)                          AS match_count,
  COUNT(DISTINCT m.outlet_id)          AS outlet_count,
  MIN(m.id::text)                      AS sample_menu_item_id,
  CASE WHEN COUNT(m.id)=0 THEN '>> TIDAK ADA MATCH'
       WHEN COUNT(m.id)>1 THEN 'ambigu (banyak baris)'
       ELSE 'ok' END           AS status
FROM produk p
LEFT JOIN menu_items m
  ON lower(btrim(m.name)) = lower(btrim(p.nama))
GROUP BY p.nama
ORDER BY status DESC, p.nama;

-- 2) Saran fuzzy untuk yang TIDAK match persis (token pertama nama, mis. "Shawarma"/"Suka").
--    Bantu lihat kemungkinan nama menu yang beda ejaan/format.
-- SELECT p.nama AS produk_cogs, m.id::text AS menu_item_id, m.name AS menu_name, m.outlet_id
-- FROM produk p
-- JOIN menu_items m ON m.name ILIKE '%' || split_part(p.nama,' ',1) || '%'
-- WHERE NOT EXISTS (SELECT 1 FROM menu_items x WHERE lower(btrim(x.name))=lower(btrim(p.nama)))
-- ORDER BY p.nama, m.name;

-- 3) (opsi) daftar semua menu_items utk review manual:
-- SELECT id::text, name, outlet_id FROM menu_items ORDER BY name;

-- 4) Daftar nama menu distinct (utk memetakan 14 produk yg TIDAK match) — jalankan ini:
-- SELECT name, COUNT(*) AS rows, COUNT(DISTINCT outlet_id) AS outlets
-- FROM menu_items GROUP BY name ORDER BY name;
