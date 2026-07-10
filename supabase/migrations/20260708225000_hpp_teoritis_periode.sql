-- 20260708220000_hpp_teoritis_periode.sql
-- Mengubah fungsi get_hpp_periode untuk menggunakan HPP Teoritis (berdasarkan resep BOM).
-- HPP aktual dari opname tidak digunakan lagi untuk dashboard harian ini agar bisa tampil realtime.

CREATE OR REPLACE FUNCTION get_hpp_periode(p_from date, p_to date)
RETURNS TABLE(outlet_id uuid, hpp numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH terjual AS (
    SELECT 
      o.outlet_id, 
      oi.menu_item_id::text AS menu_item_ref, 
      SUM(oi.quantity) as total_qty
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status = 'completed'
      AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
      AND oi.menu_item_id IS NOT NULL
    GROUP BY o.outlet_id, oi.menu_item_id
  ),
  resep_terpilih AS (
    SELECT DISTINCT ON (t.outlet_id, t.menu_item_ref)
      t.outlet_id,
      t.menu_item_ref,
      t.total_qty,
      r.id AS resep_id
    FROM terjual t
    JOIN resep r ON r.menu_item_ref = t.menu_item_ref
    WHERE r.is_active = true
      AND ( (r.scope = 'outlet' AND r.outlet_id = t.outlet_id) OR (r.scope = 'global') )
    ORDER BY t.outlet_id, t.menu_item_ref,
      CASE WHEN r.scope = 'outlet' THEN 1 ELSE 2 END
  ),
  hpp_per_item AS (
    SELECT
      rt.outlet_id,
      -- total qty terjual * (qty bahan per porsi / faktor konversi ke satuan beli) * harga beli
      rt.total_qty * (ri.qty_per_porsi / COALESCE(b.faktor_konversi, 1)) * COALESCE(bh.harga_beli, 0) AS biaya_bahan
    FROM resep_terpilih rt
    JOIN resep_item ri ON ri.resep_id = rt.resep_id
    JOIN bahan_baku b ON b.id = ri.bahan_baku_id
    LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id = ri.bahan_baku_id
  ),
  hpp_total AS (
    SELECT outlet_id, SUM(biaya_bahan) AS total_hpp
    FROM hpp_per_item
    GROUP BY outlet_id
  )
  SELECT 
    o.id AS outlet_id, 
    COALESCE(ht.total_hpp, 0) AS hpp
  FROM outlets o
  LEFT JOIN hpp_total ht ON ht.outlet_id = o.id
  WHERE o.id IN (SELECT public.accessible_outlet_ids());
$$;

GRANT EXECUTE ON FUNCTION get_hpp_periode(date, date) TO authenticated;
