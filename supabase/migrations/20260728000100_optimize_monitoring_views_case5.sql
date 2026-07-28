-- Migration: 20260728000100_optimize_monitoring_views_case5.sql
-- Description: Optimization for Case 5 (Monitoring Views & Resep Projection Performance)
-- Safe to apply: Creates supportive B-Tree indexes and optimizes view query execution.

-- 1. Supportive Indexes for Monitoring Views (Zero-Downtime, IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_resep_active_scope_outlet 
  ON public.resep(is_active, scope, outlet_id);

CREATE INDEX IF NOT EXISTS idx_resep_item_bahan_resep 
  ON public.resep_item(bahan_baku_id, resep_id);

CREATE INDEX IF NOT EXISTS idx_stok_balance_outlet_bahan 
  ON public.stok_balance(outlet_id, bahan_baku_id);

-- 2. Immutable Helper Function for Recipe Portion Conversion Math
-- Reduces 40-line duplicated CASE statement parsing overhead per row
CREATE OR REPLACE FUNCTION public.calc_porsi_qty(
  p_qty_per_porsi NUMERIC,
  p_satuan_resep TEXT,
  p_satuan_besar TEXT,
  p_satuan_kecil TEXT,
  p_faktor_tampilan NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT CASE
    WHEN lower(p_satuan_resep) = lower(p_satuan_kecil) AND COALESCE(p_faktor_tampilan, 1) > 0 
      THEN p_qty_per_porsi / p_faktor_tampilan
    WHEN lower(p_satuan_resep) IN ('gram', 'gr', 'g') AND lower(p_satuan_kecil) IN ('ml', 'mili') AND COALESCE(p_faktor_tampilan, 1) > 0 
      THEN p_qty_per_porsi / p_faktor_tampilan
    WHEN lower(p_satuan_resep) IN ('ml', 'mili') AND lower(p_satuan_kecil) IN ('gram', 'gr', 'g') AND COALESCE(p_faktor_tampilan, 1) > 0 
      THEN p_qty_per_porsi / p_faktor_tampilan
    WHEN lower(p_satuan_resep) = 'liter' AND lower(p_satuan_kecil) IN ('ml', 'mili') AND COALESCE(p_faktor_tampilan, 1) > 0 
      THEN (p_qty_per_porsi * 1000.0) / p_faktor_tampilan
    WHEN lower(p_satuan_resep) = 'kg' AND lower(p_satuan_kecil) IN ('gram', 'gr', 'g') AND COALESCE(p_faktor_tampilan, 1) > 0 
      THEN (p_qty_per_porsi * 1000.0) / p_faktor_tampilan
    WHEN lower(p_satuan_resep) IN ('gram', 'gr', 'g') AND lower(p_satuan_besar) = 'kg' 
      THEN p_qty_per_porsi / 1000.0
    WHEN lower(p_satuan_resep) IN ('ml', 'mili') AND lower(p_satuan_besar) = 'liter' 
      THEN p_qty_per_porsi / 1000.0
    WHEN lower(p_satuan_resep) = 'kg' AND lower(p_satuan_besar) IN ('gram', 'gr', 'g') 
      THEN p_qty_per_porsi * 1000.0
    WHEN lower(p_satuan_resep) = 'liter' AND lower(p_satuan_besar) IN ('ml', 'mili') 
      THEN p_qty_per_porsi * 1000.0
    WHEN lower(p_satuan_resep) = lower(p_satuan_besar) 
      THEN p_qty_per_porsi
    ELSE p_qty_per_porsi
  END;
$$;

-- 3. Optimized VIEW: monitoring_view_spv
DROP VIEW IF EXISTS public.monitoring_view_scoped CASCADE;
DROP VIEW IF EXISTS public.monitoring_view_crew CASCADE;
DROP VIEW IF EXISTS public.monitoring_view_spv CASCADE;

CREATE OR REPLACE VIEW public.monitoring_view_spv AS
WITH resep_projection AS (
  SELECT 
    ri.bahan_baku_id,
    res.outlet_id AS resep_outlet_id,
    res.scope AS resep_scope,
    res.nama AS resep_nama,
    ri.qty_per_porsi,
    ri.satuan AS ri_satuan
  FROM public.resep_item ri
  JOIN public.resep res ON res.id = ri.resep_id
  WHERE res.is_active = true AND ri.qty_per_porsi > 0
)
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
    WHEN sb.saldo < (COALESCE(orp.reorder_point, b.default_reorder_point, 10) / 2.0) THEN 'below'
    WHEN EXISTS (
        SELECT 1
        FROM resep_projection rp
        WHERE rp.bahan_baku_id = sb.bahan_baku_id
          AND (rp.resep_scope = 'global' OR rp.resep_outlet_id = sb.outlet_id)
          AND (
            sb.saldo IS NULL OR 
            (sb.saldo / NULLIF(public.calc_porsi_qty(rp.qty_per_porsi, rp.ri_satuan, b.satuan, b.satuan_kecil, b.faktor_tampilan), 0)) < COALESCE(o.marquee_warning_threshold, 7)
          )
    ) THEN 'below'
    WHEN sb.saldo < COALESCE(orp.reorder_point, b.default_reorder_point, 10) THEN 'warning'
    ELSE 'ok'
  END             AS status,
  (
    SELECT string_agg(rp.resep_nama || ' (' || FLOOR(COALESCE(sb.saldo, 0) / NULLIF(public.calc_porsi_qty(rp.qty_per_porsi, rp.ri_satuan, b.satuan, b.satuan_kecil, b.faktor_tampilan), 0))::int || ' porsi)', ' atau ')
    FROM resep_projection rp
    WHERE rp.bahan_baku_id = sb.bahan_baku_id
      AND (rp.resep_scope = 'global' OR rp.resep_outlet_id = sb.outlet_id)
  ) AS projection_text,
  FALSE           AS is_flagged,
  sb.updated_at   AS last_updated,
  NULL::TIMESTAMPTZ AS last_opname_date
FROM public.stok_balance sb
JOIN public.outlets      o   ON sb.outlet_id     = o.id
JOIN public.bahan_baku   b   ON sb.bahan_baku_id = b.id
LEFT JOIN public.outlet_reorder_point orp
       ON orp.outlet_id     = sb.outlet_id
      AND orp.bahan_baku_id = sb.bahan_baku_id
WHERE b.is_active = true
ORDER BY o.name, b.nama;

ALTER VIEW public.monitoring_view_spv OWNER TO postgres;
GRANT SELECT ON public.monitoring_view_spv TO authenticated;

-- 4. Optimized VIEW: monitoring_view_crew
CREATE OR REPLACE VIEW public.monitoring_view_crew AS
WITH resep_projection AS (
  SELECT 
    ri.bahan_baku_id,
    res.outlet_id AS resep_outlet_id,
    res.scope AS resep_scope,
    res.nama AS resep_nama,
    ri.qty_per_porsi,
    ri.satuan AS ri_satuan
  FROM public.resep_item ri
  JOIN public.resep res ON res.id = ri.resep_id
  WHERE res.is_active = true AND ri.qty_per_porsi > 0
)
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
    WHEN sb.saldo < (COALESCE(orp.reorder_point, b.default_reorder_point, 10) / 2.0) THEN 'below'
    WHEN EXISTS (
        SELECT 1
        FROM resep_projection rp
        WHERE rp.bahan_baku_id = sb.bahan_baku_id
          AND (rp.resep_scope = 'global' OR rp.resep_outlet_id = sb.outlet_id)
          AND (
            sb.saldo IS NULL OR 
            (sb.saldo / NULLIF(public.calc_porsi_qty(rp.qty_per_porsi, rp.ri_satuan, b.satuan, b.satuan_kecil, b.faktor_tampilan), 0)) < COALESCE(o.marquee_warning_threshold, 7)
          )
    ) THEN 'below'
    WHEN sb.saldo < COALESCE(orp.reorder_point, b.default_reorder_point, 10) THEN 'warning'
    ELSE 'ok'
  END             AS status,
  (
    SELECT string_agg(rp.resep_nama || ' (' || FLOOR(COALESCE(sb.saldo, 0) / NULLIF(public.calc_porsi_qty(rp.qty_per_porsi, rp.ri_satuan, b.satuan, b.satuan_kecil, b.faktor_tampilan), 0))::int || ' porsi)', ' atau ')
    FROM resep_projection rp
    WHERE rp.bahan_baku_id = sb.bahan_baku_id
      AND (rp.resep_scope = 'global' OR rp.resep_outlet_id = sb.outlet_id)
  ) AS projection_text,
  FALSE           AS is_flagged,
  sb.updated_at   AS last_updated,
  NULL::TIMESTAMPTZ AS last_opname_date
FROM public.stok_balance sb
JOIN public.outlets      o   ON sb.outlet_id     = o.id
JOIN public.bahan_baku   b   ON sb.bahan_baku_id = b.id
LEFT JOIN public.outlet_reorder_point orp
       ON orp.outlet_id     = sb.outlet_id
      AND orp.bahan_baku_id = sb.bahan_baku_id
WHERE b.is_active = true
ORDER BY b.nama;

ALTER VIEW public.monitoring_view_crew OWNER TO postgres;
GRANT SELECT ON public.monitoring_view_crew TO authenticated;

-- 5. Optimized VIEW: monitoring_view_scoped
CREATE OR REPLACE VIEW public.monitoring_view_scoped AS
SELECT *
FROM public.monitoring_view_spv
WHERE outlet_id IN (SELECT public.accessible_outlet_ids());

ALTER VIEW public.monitoring_view_scoped OWNER TO postgres;
GRANT SELECT ON public.monitoring_view_scoped TO authenticated;
