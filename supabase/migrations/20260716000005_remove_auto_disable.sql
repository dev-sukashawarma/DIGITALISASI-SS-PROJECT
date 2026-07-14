-- 0. Ensure outlets.marquee_warning_threshold column exists
ALTER TABLE public.outlets ADD COLUMN IF NOT EXISTS marquee_warning_threshold INT DEFAULT 7 NOT NULL;

-- 1. Remove auto disable logic from process_menu_sync_queue
CREATE OR REPLACE FUNCTION public.process_menu_sync_queue()
RETURNS void AS $$
BEGIN
    DELETE FROM public.menu_sync_queue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Clear out any existing auto_unavailable_menu_ids
UPDATE public.kiosk_settings 
SET value = '[]'::jsonb::text 
WHERE key = 'auto_unavailable_menu_ids';

-- 3. Recreate monitoring_view_crew to include projection_text and respect marquee_warning_threshold
DROP VIEW IF EXISTS monitoring_view_crew;

CREATE OR REPLACE VIEW monitoring_view_crew AS
SELECT
  sb.outlet_id,
  o.name          AS outlet_name,
  sb.bahan_baku_id,
  b.nama          AS item_name,
  b.satuan,
  b.kategori,
  sb.saldo        AS current_qty,
  COALESCE(orp.reorder_point, b.default_reorder_point, 10) AS threshold,
  CASE
    WHEN EXISTS (
        SELECT 1
        FROM public.resep_item ri
        JOIN public.resep res ON res.id = ri.resep_id
        WHERE ri.bahan_baku_id = sb.bahan_baku_id
          AND (res.scope = 'global' OR res.outlet_id = sb.outlet_id)
          AND res.is_active = true
          AND ri.qty_per_porsi > 0
          AND (
            sb.saldo IS NULL OR 
            (sb.saldo / 
              CASE 
                  WHEN lower(ri.satuan) = 'gram' AND lower(b.satuan) = 'kg' THEN ri.qty_per_porsi / 1000.0
                  WHEN lower(ri.satuan) = 'ml' AND lower(b.satuan) = 'liter' THEN ri.qty_per_porsi / 1000.0
                  WHEN lower(ri.satuan) = 'kg' AND lower(b.satuan) = 'gram' THEN ri.qty_per_porsi * 1000.0
                  WHEN lower(ri.satuan) = 'liter' AND lower(b.satuan) = 'ml' THEN ri.qty_per_porsi * 1000.0
                  ELSE ri.qty_per_porsi
              END
            ) < COALESCE(o.marquee_warning_threshold, 7)
          )
    ) THEN 'below'
    WHEN sb.saldo < COALESCE(orp.reorder_point, b.default_reorder_point, 10) THEN 'warning'
    ELSE 'ok'
  END             AS status,
  (
    SELECT string_agg(res.nama || ' (' || FLOOR(COALESCE(sb.saldo, 0) / 
      CASE 
          WHEN lower(ri.satuan) = 'gram' AND lower(b.satuan) = 'kg' THEN ri.qty_per_porsi / 1000.0
          WHEN lower(ri.satuan) = 'ml' AND lower(b.satuan) = 'liter' THEN ri.qty_per_porsi / 1000.0
          WHEN lower(ri.satuan) = 'kg' AND lower(b.satuan) = 'gram' THEN ri.qty_per_porsi * 1000.0
          WHEN lower(ri.satuan) = 'liter' AND lower(b.satuan) = 'ml' THEN ri.qty_per_porsi * 1000.0
          ELSE ri.qty_per_porsi
      END
    )::int || ' porsi)', ' atau ')
    FROM public.resep_item ri
    JOIN public.resep res ON res.id = ri.resep_id
    WHERE ri.bahan_baku_id = sb.bahan_baku_id
      AND (res.scope = 'global' OR res.outlet_id = sb.outlet_id)
      AND res.is_active = true
      AND ri.qty_per_porsi > 0
  ) AS projection_text,
  FALSE           AS is_flagged,
  sb.updated_at   AS last_updated,
  NULL::TIMESTAMPTZ AS last_opname_date
FROM stok_balance sb
JOIN outlets      o   ON sb.outlet_id     = o.id
JOIN bahan_baku   b   ON sb.bahan_baku_id = b.id
LEFT JOIN outlet_reorder_point orp
       ON orp.outlet_id     = sb.outlet_id
      AND orp.bahan_baku_id = sb.bahan_baku_id
WHERE b.is_active = true
ORDER BY b.nama;

ALTER VIEW monitoring_view_crew OWNER TO postgres;
GRANT SELECT ON monitoring_view_crew TO authenticated;
