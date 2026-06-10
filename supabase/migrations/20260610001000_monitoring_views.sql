-- Monitoring view untuk SPV (multi-outlet)
CREATE OR REPLACE VIEW monitoring_view_spv AS
SELECT 
  sb.outlet_id,
  o.name as outlet_name,
  sb.bahan_baku_id,
  b.nama as item_name,
  b.satuan,
  b.kategori,
  sb.saldo as current_qty,
  COALESCE(b.default_reorder_point, 10) as threshold,
  CASE
    WHEN sb.saldo < COALESCE(b.default_reorder_point, 10) / 2 THEN 'below'
    WHEN sb.saldo < COALESCE(b.default_reorder_point, 10) THEN 'warning'
    ELSE 'ok'
  END as status,
  FALSE as is_flagged,
  sb.updated_at as last_updated,
  (
    SELECT MAX(oi.created_at)
    FROM opname_item oi
    JOIN opname op ON oi.opname_id = op.id
    WHERE oi.bahan_baku_id = sb.bahan_baku_id
      AND op.outlet_id = sb.outlet_id
      AND op.status = 'finalized'
    ORDER BY op.created_at DESC
    LIMIT 1
  ) as last_opname_date
FROM stok_balance sb
JOIN outlets o ON sb.outlet_id = o.id
JOIN bahan_baku b ON sb.bahan_baku_id = b.id
ORDER BY o.name, b.nama;

-- Monitoring view untuk Crew (single outlet, RLS enforced)
CREATE OR REPLACE VIEW monitoring_view_crew AS
SELECT 
  sb.outlet_id,
  o.name as outlet_name,
  sb.bahan_baku_id,
  b.nama as item_name,
  b.satuan,
  b.kategori,
  sb.saldo as current_qty,
  COALESCE(b.default_reorder_point, 10) as threshold,
  CASE
    WHEN sb.saldo < COALESCE(b.default_reorder_point, 10) / 2 THEN 'below'
    WHEN sb.saldo < COALESCE(b.default_reorder_point, 10) THEN 'warning'
    ELSE 'ok'
  END as status,
  FALSE as is_flagged,
  sb.updated_at as last_updated,
  (
    SELECT MAX(oi.created_at)
    FROM opname_item oi
    JOIN opname op ON oi.opname_id = op.id
    WHERE oi.bahan_baku_id = sb.bahan_baku_id
      AND op.outlet_id = sb.outlet_id
      AND op.status = 'finalized'
    ORDER BY op.created_at DESC
    LIMIT 1
  ) as last_opname_date
FROM stok_balance sb
JOIN outlets o ON sb.outlet_id = o.id
JOIN bahan_baku b ON sb.bahan_baku_id = b.id
ORDER BY b.nama;

-- Enable RLS on views (views inherit RLS from underlying tables)
ALTER VIEW monitoring_view_spv SET (security_barrier = on);
ALTER VIEW monitoring_view_crew SET (security_barrier = on);
