-- 20260727140000_add_threshold_percentage.sql
-- Add threshold type and percentage to bahan_baku and outlet_reorder_point

-- 1. Add columns to bahan_baku
ALTER TABLE public.bahan_baku
ADD COLUMN stok_ideal NUMERIC,
ADD COLUMN threshold_type VARCHAR(20) DEFAULT 'angka' CHECK (threshold_type IN ('angka', 'persentase')),
ADD COLUMN threshold_persentase NUMERIC;

-- 2. Add columns to outlet_reorder_point
ALTER TABLE public.outlet_reorder_point
ADD COLUMN stok_ideal NUMERIC,
ADD COLUMN threshold_type VARCHAR(20) DEFAULT 'angka' CHECK (threshold_type IN ('angka', 'persentase')),
ADD COLUMN threshold_persentase NUMERIC;

-- 3. Drop dependent views
DROP VIEW IF EXISTS public.monitoring_view_crew CASCADE;
DROP VIEW IF EXISTS public.monitoring_view_spv CASCADE;

-- 4. Recreate monitoring_view_spv
CREATE OR REPLACE VIEW public.monitoring_view_spv AS
SELECT
  sb.outlet_id,
  o.name          AS outlet_name,
  sb.bahan_baku_id,
  b.nama          AS item_name,
  b.satuan,
  b.kategori,
  sb.saldo        AS current_qty,

  
  -- KALKULASI EFEKTIF THRESHOLD BARU
  CASE
    WHEN COALESCE(orp.threshold_type, b.threshold_type, 'angka') = 'persentase' THEN
       (COALESCE(orp.threshold_persentase, b.threshold_persentase, 20) / 100.0) * COALESCE(orp.stok_ideal, b.stok_ideal, COALESCE(orp.reorder_point, b.default_reorder_point, 10))
    ELSE COALESCE(orp.reorder_point, b.default_reorder_point, 10)
  END AS threshold,

  CASE
    WHEN sb.saldo < (
      CASE
        WHEN COALESCE(orp.threshold_type, b.threshold_type, 'angka') = 'persentase' THEN
           (COALESCE(orp.threshold_persentase, b.threshold_persentase, 20) / 100.0) * COALESCE(orp.stok_ideal, b.stok_ideal, COALESCE(orp.reorder_point, b.default_reorder_point, 10))
        ELSE COALESCE(orp.reorder_point, b.default_reorder_point, 10)
      END
    ) / 2.0 THEN 'below'
    
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
                  WHEN lower(ri.satuan) = lower(b.satuan_kecil) AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) IN ('pcs', 'lembar', 'bungkus', 'pack') AND lower(b.satuan_kecil) IN ('pcs', 'lembar', 'bungkus', 'pack') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
                  -- (REMOVED: satuan_tengah does not exist on bahan_baku)
                  WHEN lower(ri.satuan) IN ('gram', 'gr', 'g') AND lower(b.satuan_kecil) IN ('ml', 'mili') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) IN ('ml', 'mili') AND lower(b.satuan_kecil) IN ('gram', 'gr', 'g') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) = 'liter' AND lower(b.satuan_kecil) IN ('ml', 'mili') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi * 1000.0) / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) = 'kg' AND lower(b.satuan_kecil) IN ('gram', 'gr', 'g') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi * 1000.0) / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) IN ('gram', 'gr', 'g') AND lower(b.satuan_kecil) = 'kg' AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi / 1000.0) / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) IN ('ml', 'mili') AND lower(b.satuan_kecil) = 'liter' AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi / 1000.0) / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) IN ('gram', 'gr', 'g') AND lower(b.satuan) = 'kg' THEN ri.qty_per_porsi / 1000.0
                  WHEN lower(ri.satuan) IN ('ml', 'mili') AND lower(b.satuan) = 'liter' THEN ri.qty_per_porsi / 1000.0
                  WHEN lower(ri.satuan) = 'kg' AND lower(b.satuan) IN ('gram', 'gr', 'g') THEN ri.qty_per_porsi * 1000.0
                  WHEN lower(ri.satuan) = 'liter' AND lower(b.satuan) IN ('ml', 'mili') THEN ri.qty_per_porsi * 1000.0
                  WHEN lower(ri.satuan) = lower(b.satuan) THEN ri.qty_per_porsi
                  WHEN lower(ri.satuan) IN ('pcs', 'lembar', 'bungkus', 'pack') AND lower(b.satuan) IN ('pcs', 'lembar', 'bungkus', 'pack') THEN ri.qty_per_porsi
                  ELSE ri.qty_per_porsi
              END
            ) < COALESCE(o.marquee_warning_threshold, 7)
          )
    ) THEN 'below'
    
    WHEN sb.saldo < (
      CASE
        WHEN COALESCE(orp.threshold_type, b.threshold_type, 'angka') = 'persentase' THEN
           (COALESCE(orp.threshold_persentase, b.threshold_persentase, 20) / 100.0) * COALESCE(orp.stok_ideal, b.stok_ideal, COALESCE(orp.reorder_point, b.default_reorder_point, 10))
        ELSE COALESCE(orp.reorder_point, b.default_reorder_point, 10)
      END
    ) THEN 'warning'
    ELSE 'ok'
  END             AS status,
  
  (sb.saldo < (
      CASE
        WHEN COALESCE(orp.threshold_type, b.threshold_type, 'angka') = 'persentase' THEN
           (COALESCE(orp.threshold_persentase, b.threshold_persentase, 20) / 100.0) * COALESCE(orp.stok_ideal, b.stok_ideal, COALESCE(orp.reorder_point, b.default_reorder_point, 10))
        ELSE COALESCE(orp.reorder_point, b.default_reorder_point, 10)
      END
  )) AS is_flagged,
  
  (
    SELECT opname.created_at
    FROM public.opname_item
    JOIN public.opname ON opname.id = opname_item.opname_id
    WHERE opname_item.bahan_baku_id = sb.bahan_baku_id
      AND opname.outlet_id = sb.outlet_id
    ORDER BY opname.created_at DESC
    LIMIT 1
  )               AS last_opname_date,
  (
    SELECT string_agg(res.nama || ' (' || FLOOR(COALESCE(sb.saldo, 0) / 
      CASE 
          WHEN lower(ri.satuan) = lower(b.satuan_kecil) AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
          WHEN lower(ri.satuan) IN ('pcs', 'lembar', 'bungkus', 'pack') AND lower(b.satuan_kecil) IN ('pcs', 'lembar', 'bungkus', 'pack') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
          -- (REMOVED: satuan_tengah does not exist on bahan_baku)
          WHEN lower(ri.satuan) IN ('gram', 'gr', 'g') AND lower(b.satuan_kecil) IN ('ml', 'mili') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
          WHEN lower(ri.satuan) IN ('ml', 'mili') AND lower(b.satuan_kecil) IN ('gram', 'gr', 'g') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
          WHEN lower(ri.satuan) = 'liter' AND lower(b.satuan_kecil) IN ('ml', 'mili') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi * 1000.0) / b.faktor_tampilan::numeric
          WHEN lower(ri.satuan) = 'kg' AND lower(b.satuan_kecil) IN ('gram', 'gr', 'g') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi * 1000.0) / b.faktor_tampilan::numeric
          WHEN lower(ri.satuan) IN ('gram', 'gr', 'g') AND lower(b.satuan_kecil) = 'kg' AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi / 1000.0) / b.faktor_tampilan::numeric
          WHEN lower(ri.satuan) IN ('ml', 'mili') AND lower(b.satuan_kecil) = 'liter' AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi / 1000.0) / b.faktor_tampilan::numeric
          WHEN lower(ri.satuan) IN ('gram', 'gr', 'g') AND lower(b.satuan) = 'kg' THEN ri.qty_per_porsi / 1000.0
          WHEN lower(ri.satuan) IN ('ml', 'mili') AND lower(b.satuan) = 'liter' THEN ri.qty_per_porsi / 1000.0
          WHEN lower(ri.satuan) = 'kg' AND lower(b.satuan) IN ('gram', 'gr', 'g') THEN ri.qty_per_porsi * 1000.0
          WHEN lower(ri.satuan) = 'liter' AND lower(b.satuan) IN ('ml', 'mili') THEN ri.qty_per_porsi * 1000.0
          WHEN lower(ri.satuan) = lower(b.satuan) THEN ri.qty_per_porsi
          WHEN lower(ri.satuan) IN ('pcs', 'lembar', 'bungkus', 'pack') AND lower(b.satuan) IN ('pcs', 'lembar', 'bungkus', 'pack') THEN ri.qty_per_porsi
          ELSE ri.qty_per_porsi
      END
    )::int || ' porsi)', ' atau ')
    FROM public.resep_item ri
    JOIN public.resep res ON res.id = ri.resep_id
    WHERE ri.bahan_baku_id = sb.bahan_baku_id
      AND (res.scope = 'global' OR res.outlet_id = sb.outlet_id)
      AND res.is_active = true
  ) AS projection_text,
  sb.updated_at   AS last_updated
FROM public.stok_balance sb
JOIN public.bahan_baku b ON b.id = sb.bahan_baku_id
JOIN public.outlets o ON o.id = sb.outlet_id
LEFT JOIN public.outlet_reorder_point orp ON orp.outlet_id = sb.outlet_id AND orp.bahan_baku_id = sb.bahan_baku_id
WHERE b.is_active = true;

ALTER VIEW public.monitoring_view_spv OWNER TO postgres;
GRANT SELECT ON public.monitoring_view_spv TO authenticated;
GRANT SELECT ON public.monitoring_view_spv TO anon;

-- VIEW UNTUK SCOPED (Leader)
CREATE OR REPLACE VIEW public.monitoring_view_scoped AS
SELECT *
FROM public.monitoring_view_spv
WHERE outlet_id IN (
  SELECT public.accessible_outlet_ids()
);

ALTER VIEW public.monitoring_view_scoped OWNER TO postgres;
GRANT SELECT ON public.monitoring_view_scoped TO authenticated;
GRANT SELECT ON public.monitoring_view_scoped TO anon;

-- VIEW UNTUK CREW
CREATE OR REPLACE VIEW public.monitoring_view_crew AS
SELECT
  sb.outlet_id,
  o.name          AS outlet_name,
  sb.bahan_baku_id,
  b.nama          AS item_name,
  b.satuan,
  b.kategori,
  sb.saldo        AS current_qty,

  
  -- KALKULASI EFEKTIF THRESHOLD BARU
  CASE
    WHEN COALESCE(orp.threshold_type, b.threshold_type, 'angka') = 'persentase' THEN
       (COALESCE(orp.threshold_persentase, b.threshold_persentase, 20) / 100.0) * COALESCE(orp.stok_ideal, b.stok_ideal, COALESCE(orp.reorder_point, b.default_reorder_point, 10))
    ELSE COALESCE(orp.reorder_point, b.default_reorder_point, 10)
  END AS threshold,

  CASE
    WHEN sb.saldo < (
      CASE
        WHEN COALESCE(orp.threshold_type, b.threshold_type, 'angka') = 'persentase' THEN
           (COALESCE(orp.threshold_persentase, b.threshold_persentase, 20) / 100.0) * COALESCE(orp.stok_ideal, b.stok_ideal, COALESCE(orp.reorder_point, b.default_reorder_point, 10))
        ELSE COALESCE(orp.reorder_point, b.default_reorder_point, 10)
      END
    ) / 2.0 THEN 'below'
    
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
                  WHEN lower(ri.satuan) = lower(b.satuan_kecil) AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) IN ('pcs', 'lembar', 'bungkus', 'pack') AND lower(b.satuan_kecil) IN ('pcs', 'lembar', 'bungkus', 'pack') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
                  -- (REMOVED: satuan_tengah does not exist on bahan_baku)
                  WHEN lower(ri.satuan) IN ('gram', 'gr', 'g') AND lower(b.satuan_kecil) IN ('ml', 'mili') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) IN ('ml', 'mili') AND lower(b.satuan_kecil) IN ('gram', 'gr', 'g') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) = 'liter' AND lower(b.satuan_kecil) IN ('ml', 'mili') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi * 1000.0) / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) = 'kg' AND lower(b.satuan_kecil) IN ('gram', 'gr', 'g') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi * 1000.0) / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) IN ('gram', 'gr', 'g') AND lower(b.satuan_kecil) = 'kg' AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi / 1000.0) / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) IN ('ml', 'mili') AND lower(b.satuan_kecil) = 'liter' AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi / 1000.0) / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) IN ('gram', 'gr', 'g') AND lower(b.satuan) = 'kg' THEN ri.qty_per_porsi / 1000.0
                  WHEN lower(ri.satuan) IN ('ml', 'mili') AND lower(b.satuan) = 'liter' THEN ri.qty_per_porsi / 1000.0
                  WHEN lower(ri.satuan) = 'kg' AND lower(b.satuan) IN ('gram', 'gr', 'g') THEN ri.qty_per_porsi * 1000.0
                  WHEN lower(ri.satuan) = 'liter' AND lower(b.satuan) IN ('ml', 'mili') THEN ri.qty_per_porsi * 1000.0
                  WHEN lower(ri.satuan) = lower(b.satuan) THEN ri.qty_per_porsi
                  WHEN lower(ri.satuan) IN ('pcs', 'lembar', 'bungkus', 'pack') AND lower(b.satuan) IN ('pcs', 'lembar', 'bungkus', 'pack') THEN ri.qty_per_porsi
                  ELSE ri.qty_per_porsi
              END
            ) < COALESCE(o.marquee_warning_threshold, 7)
          )
    ) THEN 'below'
    
    WHEN sb.saldo < (
      CASE
        WHEN COALESCE(orp.threshold_type, b.threshold_type, 'angka') = 'persentase' THEN
           (COALESCE(orp.threshold_persentase, b.threshold_persentase, 20) / 100.0) * COALESCE(orp.stok_ideal, b.stok_ideal, COALESCE(orp.reorder_point, b.default_reorder_point, 10))
        ELSE COALESCE(orp.reorder_point, b.default_reorder_point, 10)
      END
    ) THEN 'warning'
    ELSE 'ok'
  END             AS status,
  
  (sb.saldo < (
      CASE
        WHEN COALESCE(orp.threshold_type, b.threshold_type, 'angka') = 'persentase' THEN
           (COALESCE(orp.threshold_persentase, b.threshold_persentase, 20) / 100.0) * COALESCE(orp.stok_ideal, b.stok_ideal, COALESCE(orp.reorder_point, b.default_reorder_point, 10))
        ELSE COALESCE(orp.reorder_point, b.default_reorder_point, 10)
      END
  )) AS is_flagged,
  
  (
    SELECT opname.created_at
    FROM public.opname_item
    JOIN public.opname ON opname.id = opname_item.opname_id
    WHERE opname_item.bahan_baku_id = sb.bahan_baku_id
      AND opname.outlet_id = sb.outlet_id
    ORDER BY opname.created_at DESC
    LIMIT 1
  )               AS last_opname_date,
  sb.updated_at   AS last_updated
FROM public.stok_balance sb
JOIN public.bahan_baku b ON b.id = sb.bahan_baku_id
JOIN public.outlets o ON o.id = sb.outlet_id
LEFT JOIN public.outlet_reorder_point orp ON orp.outlet_id = sb.outlet_id AND orp.bahan_baku_id = sb.bahan_baku_id
WHERE b.is_active = true;

ALTER VIEW public.monitoring_view_crew OWNER TO postgres;
GRANT SELECT ON public.monitoring_view_crew TO authenticated;
GRANT SELECT ON public.monitoring_view_crew TO anon;

-- Recreate purchase_suggestion_spv
CREATE OR REPLACE VIEW public.purchase_suggestion_spv AS
WITH pesan AS (
  SELECT poi.bahan_baku_id,
         COALESCE(SUM(poi.qty_pesan - COALESCE(poi.qty_terima, 0)), 0) AS sudah_dipesan
  FROM public.purchase_order_item poi
  JOIN public.purchase_order po ON po.id = poi.purchase_order_id
  WHERE po.status IN ('menunggu_approval_finance', 'dikirim_ke_supplier', 'sebagian_diterima')
  GROUP BY poi.bahan_baku_id
),
minta AS (
  SELECT pbi.bahan_baku_id,
         COALESCE(SUM(pbi.qty_diminta), 0) AS permintaan_pending
  FROM public.permintaan_bahan_item pbi
  JOIN public.permintaan_bahan pb ON pb.id = pbi.permintaan_id
  WHERE pb.status = 'menunggu'
  GROUP BY pbi.bahan_baku_id
)
SELECT
  m.bahan_baku_id,
  m.item_name                            AS nama,
  m.satuan,
  m.current_qty                          AS stok,
  m.threshold,
  f.days_left,
  COALESCE(minta.permintaan_pending, 0)  AS permintaan_pending,
  COALESCE(pesan.sudah_dipesan, 0)       AS sudah_dipesan
FROM public.monitoring_view_spv m
LEFT JOIN public.stockout_forecast_spv f
       ON f.bahan_baku_id = m.bahan_baku_id AND f.outlet_id = m.outlet_id
LEFT JOIN pesan ON pesan.bahan_baku_id = m.bahan_baku_id
LEFT JOIN minta ON minta.bahan_baku_id = m.bahan_baku_id
WHERE m.outlet_id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90';

GRANT SELECT ON public.purchase_suggestion_spv TO authenticated;
