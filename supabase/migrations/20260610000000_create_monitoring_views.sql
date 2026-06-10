-- Monitoring Views for SPV and Crew dashboards
-- Created: 2026-06-10
-- Purpose: Provide real-time stock monitoring data with status indicators

-- SPV Monitoring View (Multi-outlet for Supervisor Produksi)
-- Shows all outlets' stock status with threshold comparison and flagged items
CREATE OR REPLACE VIEW monitoring_view_spv AS
SELECT
  sb.outlet_id,
  o.name as outlet_name,
  sb.bahan_baku_id,
  bb.nama as item_name,
  sb.saldo as current_qty,
  COALESCE(bb.default_reorder_point, 0) as threshold,
  CASE
    WHEN sb.saldo < COALESCE(bb.default_reorder_point, 0) THEN 'below'
    WHEN sb.saldo < COALESCE(bb.default_reorder_point, 0) * 1.2 THEN 'warning'
    ELSE 'ok'
  END as status,
  COALESCE(oi.flagged, false) as is_flagged,
  sb.updated_at as last_updated,
  opn.created_at as last_opname_date
FROM stok_balance sb
JOIN outlets o ON sb.outlet_id = o.id
JOIN bahan_baku bb ON sb.bahan_baku_id = bb.id
LEFT JOIN (
  SELECT bahan_baku_id, flagged, opname_id
  FROM opname_item
  WHERE flagged = true
) oi ON oi.bahan_baku_id = sb.bahan_baku_id
LEFT JOIN (
  SELECT DISTINCT ON (outlet_id) outlet_id, created_at
  FROM opname
  ORDER BY outlet_id, created_at DESC
) opn ON opn.outlet_id = sb.outlet_id
WHERE bb.is_active = true
ORDER BY o.name, bb.nama;

-- Crew Monitoring View (Single-outlet for Crew with RLS)
-- Shows only the crew member's outlet stock status, filtered by auth.uid()
CREATE OR REPLACE VIEW monitoring_view_crew AS
SELECT
  sb.outlet_id,
  sb.bahan_baku_id,
  bb.nama as item_name,
  sb.saldo as current_qty,
  COALESCE(bb.default_reorder_point, 0) as threshold,
  CASE
    WHEN sb.saldo < COALESCE(bb.default_reorder_point, 0) THEN 'below'
    WHEN sb.saldo < COALESCE(bb.default_reorder_point, 0) * 1.2 THEN 'warning'
    ELSE 'ok'
  END as status,
  COALESCE(oi.flagged, false) as is_flagged,
  sb.updated_at as last_updated,
  opn.created_at as last_opname_date
FROM stok_balance sb
JOIN bahan_baku bb ON sb.bahan_baku_id = bb.id
LEFT JOIN opname_item oi ON oi.bahan_baku_id = sb.bahan_baku_id AND oi.flagged = true
LEFT JOIN (
  SELECT DISTINCT ON (outlet_id) outlet_id, created_at
  FROM opname
  ORDER BY outlet_id, created_at DESC
) opn ON opn.outlet_id = sb.outlet_id
WHERE bb.is_active = true AND sb.outlet_id = (
  -- RLS: only see own outlet
  SELECT outlet_id FROM outlet_staff WHERE id = auth.uid()
)
ORDER BY bb.nama;

-- Grant SELECT on views to authenticated users
-- (actual RLS policies inherited from base tables and view definition)
GRANT SELECT ON monitoring_view_spv TO authenticated;
GRANT SELECT ON monitoring_view_crew TO authenticated;
