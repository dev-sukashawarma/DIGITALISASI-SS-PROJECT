-- 20260708100000_diagnose_bom_resep_linkage.sql
-- DIAGNOSTIC: Cek status linkage resep BOM ↔ menu_items POS
-- Jalankan di Supabase SQL editor untuk debug masalah "bahan BOM tidak sesuai resep".
-- BUKAN migration permanen — hanya untuk investigasi.

-- 1. Resep aktif global yang punya menu_item_ref
SELECT
  r.nama AS nama_resep,
  r.menu_item_ref,
  mi.name AS nama_menu_pos,
  mi.id AS menu_item_id,
  (r.menu_item_ref = mi.id::text) AS ref_match,
  COUNT(ri.id) AS jumlah_bahan
FROM resep r
LEFT JOIN menu_items mi ON mi.id::text = r.menu_item_ref
LEFT JOIN resep_item ri ON ri.resep_id = r.id
WHERE r.scope = 'global' AND r.is_active = true
GROUP BY r.nama, r.menu_item_ref, mi.name, mi.id
ORDER BY r.nama;

-- 2. Resep aktif yang TIDAK PUNYA menu_item_ref (BOM tidak jalan)
SELECT nama, scope, is_active, created_at
FROM resep
WHERE scope = 'global' AND is_active = true AND (menu_item_ref IS NULL OR menu_item_ref = '')
ORDER BY nama;

-- 3. Resep duplikat — menu_item yg punya lebih dari 1 resep aktif global (ambiguous lookup)
SELECT menu_item_ref, COUNT(*) AS jumlah_resep, array_agg(nama) AS daftar_resep
FROM resep
WHERE scope = 'global' AND is_active = true AND menu_item_ref IS NOT NULL
GROUP BY menu_item_ref
HAVING COUNT(*) > 1
ORDER BY jumlah_resep DESC;

-- 4. Komponen tiap resep aktif — verifikasi satuan pakai vs faktor_konversi
SELECT
  r.nama AS resep,
  b.nama AS bahan,
  ri.qty_per_porsi,
  ri.satuan AS satuan_pakai,
  b.satuan AS satuan_stok,
  b.faktor_konversi,
  ROUND(ri.qty_per_porsi / b.faktor_konversi, 6) AS qty_dalam_satuan_stok
FROM resep r
JOIN resep_item ri ON ri.resep_id = r.id
JOIN bahan_baku b ON b.id = ri.bahan_baku_id
WHERE r.scope = 'global' AND r.is_active = true
ORDER BY r.nama, b.nama;
