-- 20260714110000_waste_budget_gap.sql
-- "Budget Loss" per outlet untuk rentang periode: buffer_amount (kolom "Loss"
-- di resep, migration 20260707140000_cogs_card_display.sql) dikalikan qty
-- terjual per resep yang laku pada periode itu. Pola CTE identik
-- get_hpp_periode (20260708225000_hpp_teoritis_periode.sql), hanya beda
-- kalkulasi biaya: buffer_amount, bukan harga bahan baku.
-- Tidak ada guard owner/admin (sama seperti get_waste_periode) — hanya
-- scoping outlet standar via accessible_outlet_ids().

CREATE OR REPLACE FUNCTION get_budget_loss_periode(p_from date, p_to date)
RETURNS TABLE(outlet_id uuid, budget_loss numeric)
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
      r.id AS resep_id,
      r.buffer_amount
    FROM terjual t
    JOIN resep r ON r.menu_item_ref = t.menu_item_ref
    WHERE r.is_active = true
      AND ( (r.scope = 'outlet' AND r.outlet_id = t.outlet_id) OR (r.scope = 'global') )
    ORDER BY t.outlet_id, t.menu_item_ref,
      CASE WHEN r.scope = 'outlet' THEN 1 ELSE 2 END
  ),
  budget_per_outlet AS (
    SELECT outlet_id, SUM(total_qty * buffer_amount) AS total_budget
    FROM resep_terpilih
    GROUP BY outlet_id
  )
  SELECT
    o.id AS outlet_id,
    COALESCE(bp.total_budget, 0) AS budget_loss
  FROM outlets o
  LEFT JOIN budget_per_outlet bp ON bp.outlet_id = o.id
  WHERE o.id IN (SELECT public.accessible_outlet_ids());
$$;

GRANT EXECUTE ON FUNCTION get_budget_loss_periode(date, date) TO authenticated;
