-- =============================================================================
-- FIX: Konversi Satuan Universal & Pemulihan Perlindungan Stok Fisik
-- =============================================================================

DROP VIEW IF EXISTS monitoring_view_scoped;
DROP VIEW IF EXISTS monitoring_view_crew;
DROP VIEW IF EXISTS monitoring_view_spv;

-- 1. VIEW UNTUK SPV
CREATE OR REPLACE VIEW monitoring_view_spv AS
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
    -- [KEMBALIKAN PERLINDUNGAN FISIK]: Jika stok kurang dari 50% threshold, PASTI KRITIS
    WHEN sb.saldo < (COALESCE(orp.reorder_point, b.default_reorder_point, 10) / 2.0) THEN 'below'
    
    -- [CEK PROYEKSI RESEP]: Jika sisa porsi di bawah batas marquee
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
                  -- 1. Resep persis sama dengan Satuan Kecil
                  WHEN lower(ri.satuan) = lower(b.satuan_kecil) AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
                  
                  -- 2. Resep menggunakan gram/ml, tapi master data kebalik (Toleransi gram <-> ml)
                  WHEN lower(ri.satuan) IN ('gram', 'gr', 'g') AND lower(b.satuan_kecil) IN ('ml', 'mili') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) IN ('ml', 'mili') AND lower(b.satuan_kecil) IN ('gram', 'gr', 'g') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
                  
                  -- 3. Resep menggunakan Liter/Kg, tapi master data Kompan/Karton
                  WHEN lower(ri.satuan) = 'liter' AND lower(b.satuan_kecil) IN ('ml', 'mili') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi * 1000.0) / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) = 'kg' AND lower(b.satuan_kecil) IN ('gram', 'gr', 'g') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi * 1000.0) / b.faktor_tampilan::numeric
                  
                  -- 4. Logika Bawaan Lama
                  WHEN lower(ri.satuan) IN ('gram', 'gr', 'g') AND lower(b.satuan) = 'kg' THEN ri.qty_per_porsi / 1000.0
                  WHEN lower(ri.satuan) IN ('ml', 'mili') AND lower(b.satuan) = 'liter' THEN ri.qty_per_porsi / 1000.0
                  WHEN lower(ri.satuan) = 'kg' AND lower(b.satuan) IN ('gram', 'gr', 'g') THEN ri.qty_per_porsi * 1000.0
                  WHEN lower(ri.satuan) = 'liter' AND lower(b.satuan) IN ('ml', 'mili') THEN ri.qty_per_porsi * 1000.0
                  
                  -- 5. Resep menggunakan satuan besar yang sama (Kompan = Kompan)
                  WHEN lower(ri.satuan) = lower(b.satuan) THEN ri.qty_per_porsi
                  
                  -- Fallback
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
          WHEN lower(ri.satuan) = lower(b.satuan_kecil) AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
          WHEN lower(ri.satuan) IN ('gram', 'gr', 'g') AND lower(b.satuan_kecil) IN ('ml', 'mili') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
          WHEN lower(ri.satuan) IN ('ml', 'mili') AND lower(b.satuan_kecil) IN ('gram', 'gr', 'g') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
          WHEN lower(ri.satuan) = 'liter' AND lower(b.satuan_kecil) IN ('ml', 'mili') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi * 1000.0) / b.faktor_tampilan::numeric
          WHEN lower(ri.satuan) = 'kg' AND lower(b.satuan_kecil) IN ('gram', 'gr', 'g') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi * 1000.0) / b.faktor_tampilan::numeric
          WHEN lower(ri.satuan) IN ('gram', 'gr', 'g') AND lower(b.satuan) = 'kg' THEN ri.qty_per_porsi / 1000.0
          WHEN lower(ri.satuan) IN ('ml', 'mili') AND lower(b.satuan) = 'liter' THEN ri.qty_per_porsi / 1000.0
          WHEN lower(ri.satuan) = 'kg' AND lower(b.satuan) IN ('gram', 'gr', 'g') THEN ri.qty_per_porsi * 1000.0
          WHEN lower(ri.satuan) = 'liter' AND lower(b.satuan) IN ('ml', 'mili') THEN ri.qty_per_porsi * 1000.0
          WHEN lower(ri.satuan) = lower(b.satuan) THEN ri.qty_per_porsi
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
ORDER BY o.name, b.nama;

ALTER VIEW monitoring_view_spv OWNER TO postgres;

-- 2. VIEW UNTUK CREW
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
    -- [KEMBALIKAN PERLINDUNGAN FISIK]
    WHEN sb.saldo < (COALESCE(orp.reorder_point, b.default_reorder_point, 10) / 2.0) THEN 'below'
    
    -- [CEK PROYEKSI RESEP]
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
                  WHEN lower(ri.satuan) IN ('gram', 'gr', 'g') AND lower(b.satuan_kecil) IN ('ml', 'mili') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) IN ('ml', 'mili') AND lower(b.satuan_kecil) IN ('gram', 'gr', 'g') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) = 'liter' AND lower(b.satuan_kecil) IN ('ml', 'mili') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi * 1000.0) / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) = 'kg' AND lower(b.satuan_kecil) IN ('gram', 'gr', 'g') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi * 1000.0) / b.faktor_tampilan::numeric
                  WHEN lower(ri.satuan) IN ('gram', 'gr', 'g') AND lower(b.satuan) = 'kg' THEN ri.qty_per_porsi / 1000.0
                  WHEN lower(ri.satuan) IN ('ml', 'mili') AND lower(b.satuan) = 'liter' THEN ri.qty_per_porsi / 1000.0
                  WHEN lower(ri.satuan) = 'kg' AND lower(b.satuan) IN ('gram', 'gr', 'g') THEN ri.qty_per_porsi * 1000.0
                  WHEN lower(ri.satuan) = 'liter' AND lower(b.satuan) IN ('ml', 'mili') THEN ri.qty_per_porsi * 1000.0
                  WHEN lower(ri.satuan) = lower(b.satuan) THEN ri.qty_per_porsi
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
          WHEN lower(ri.satuan) = lower(b.satuan_kecil) AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
          WHEN lower(ri.satuan) IN ('gram', 'gr', 'g') AND lower(b.satuan_kecil) IN ('ml', 'mili') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
          WHEN lower(ri.satuan) IN ('ml', 'mili') AND lower(b.satuan_kecil) IN ('gram', 'gr', 'g') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN ri.qty_per_porsi / b.faktor_tampilan::numeric
          WHEN lower(ri.satuan) = 'liter' AND lower(b.satuan_kecil) IN ('ml', 'mili') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi * 1000.0) / b.faktor_tampilan::numeric
          WHEN lower(ri.satuan) = 'kg' AND lower(b.satuan_kecil) IN ('gram', 'gr', 'g') AND COALESCE(b.faktor_tampilan, 1) > 0 THEN (ri.qty_per_porsi * 1000.0) / b.faktor_tampilan::numeric
          WHEN lower(ri.satuan) IN ('gram', 'gr', 'g') AND lower(b.satuan) = 'kg' THEN ri.qty_per_porsi / 1000.0
          WHEN lower(ri.satuan) IN ('ml', 'mili') AND lower(b.satuan) = 'liter' THEN ri.qty_per_porsi / 1000.0
          WHEN lower(ri.satuan) = 'kg' AND lower(b.satuan) IN ('gram', 'gr', 'g') THEN ri.qty_per_porsi * 1000.0
          WHEN lower(ri.satuan) = 'liter' AND lower(b.satuan) IN ('ml', 'mili') THEN ri.qty_per_porsi * 1000.0
          WHEN lower(ri.satuan) = lower(b.satuan) THEN ri.qty_per_porsi
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

-- 3. RECREATE SCOPED VIEW
CREATE OR REPLACE VIEW monitoring_view_scoped AS
SELECT *
FROM monitoring_view_spv
WHERE outlet_id IN (SELECT accessible_outlet_ids());

ALTER VIEW monitoring_view_scoped OWNER TO postgres;
