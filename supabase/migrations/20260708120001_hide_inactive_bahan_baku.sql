-- =============================================================================
-- FIX: Sembunyikan bahan baku yang sudah tidak aktif (is_active = false)
-- dari tampilan monitoring stok.
-- =============================================================================

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
    WHEN sb.saldo < COALESCE(orp.reorder_point, b.default_reorder_point, 10) / 2.0 THEN 'below'
    WHEN sb.saldo < COALESCE(orp.reorder_point, b.default_reorder_point, 10)       THEN 'warning'
    ELSE 'ok'
  END             AS status,
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
    WHEN sb.saldo < COALESCE(orp.reorder_point, b.default_reorder_point, 10) / 2.0 THEN 'below'
    WHEN sb.saldo < COALESCE(orp.reorder_point, b.default_reorder_point, 10)       THEN 'warning'
    ELSE 'ok'
  END             AS status,
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

CREATE OR REPLACE VIEW monitoring_view_scoped AS
SELECT *
FROM monitoring_view_spv
WHERE outlet_id IN (SELECT accessible_outlet_ids());

ALTER VIEW monitoring_view_scoped OWNER TO postgres;

CREATE OR REPLACE VIEW stockout_forecast_spv AS
WITH usage AS (
  SELECT
    outlet_id,
    bahan_baku_id,
    SUM(ABS(qty)) / 7.0 AS daily_rate
  FROM ledger_stok
  WHERE tipe = 'pemakaian'
    AND created_at >= NOW() - INTERVAL '7 days'
  GROUP BY outlet_id, bahan_baku_id
)
SELECT
  sb.outlet_id,
  o.name        AS outlet_name,
  sb.bahan_baku_id,
  b.nama        AS item_name,
  b.satuan,
  sb.saldo      AS current_qty,
  COALESCE(b.default_reorder_point, 10) AS threshold,
  u.daily_rate,
  sb.saldo / u.daily_rate AS days_left
FROM stok_balance sb
JOIN outlets o     ON sb.outlet_id = o.id
JOIN bahan_baku b  ON sb.bahan_baku_id = b.id
JOIN usage u       ON u.outlet_id = sb.outlet_id
                  AND u.bahan_baku_id = sb.bahan_baku_id
WHERE u.daily_rate > 0
  AND b.is_active = true;

ALTER VIEW stockout_forecast_spv SET (security_barrier = on);
