-- =============================================================================
-- FIX: monitoring_view_spv & monitoring_view_crew jadi SECURITY DEFINER
-- agar bypass RLS stok_balance (yang hanya membatasi per outlet_staff).
--
-- Root cause: security_barrier view TIDAK bypass RLS tabel underlying.
-- SPV yang bukan anggota outlet_staff setiap outlet dapat hasil kosong.
--
-- Solusi: recreate sebagai function-based view dengan SECURITY DEFINER, 
-- sama polanya dengan ledger_feed_spv yang sudah berjalan.
-- =============================================================================

-- Drop view lama dulu
DROP VIEW IF EXISTS monitoring_view_spv;
DROP VIEW IF EXISTS monitoring_view_crew;

-- Recreate monitoring_view_spv sebagai SECURITY DEFINER view
CREATE OR REPLACE VIEW monitoring_view_spv AS
SELECT
  sb.outlet_id,
  o.name          AS outlet_name,
  sb.bahan_baku_id,
  b.nama          AS item_name,
  b.satuan,
  b.kategori,
  sb.saldo        AS current_qty,
  COALESCE(b.default_reorder_point, 10) AS threshold,
  CASE
    WHEN sb.saldo < COALESCE(b.default_reorder_point, 10) / 2.0 THEN 'below'
    WHEN sb.saldo < COALESCE(b.default_reorder_point, 10)       THEN 'warning'
    ELSE 'ok'
  END             AS status,
  FALSE           AS is_flagged,
  sb.updated_at   AS last_updated,
  NULL::TIMESTAMPTZ AS last_opname_date
FROM stok_balance sb
JOIN outlets      o ON sb.outlet_id     = o.id
JOIN bahan_baku   b ON sb.bahan_baku_id = b.id
ORDER BY o.name, b.nama;

-- SECURITY DEFINER: view dieksekusi dengan hak pemilik (postgres),
-- bukan hak caller → bypass RLS stok_balance untuk SPV.
ALTER VIEW monitoring_view_spv OWNER TO postgres;

-- Recreate monitoring_view_crew sebagai SECURITY DEFINER view
-- (crew lihat semua bahan outlet mereka — filter dilakukan di aplikasi)
CREATE OR REPLACE VIEW monitoring_view_crew AS
SELECT
  sb.outlet_id,
  o.name          AS outlet_name,
  sb.bahan_baku_id,
  b.nama          AS item_name,
  b.satuan,
  b.kategori,
  sb.saldo        AS current_qty,
  COALESCE(b.default_reorder_point, 10) AS threshold,
  CASE
    WHEN sb.saldo < COALESCE(b.default_reorder_point, 10) / 2.0 THEN 'below'
    WHEN sb.saldo < COALESCE(b.default_reorder_point, 10)       THEN 'warning'
    ELSE 'ok'
  END             AS status,
  FALSE           AS is_flagged,
  sb.updated_at   AS last_updated,
  NULL::TIMESTAMPTZ AS last_opname_date
FROM stok_balance sb
JOIN outlets      o ON sb.outlet_id     = o.id
JOIN bahan_baku   b ON sb.bahan_baku_id = b.id
ORDER BY b.nama;

ALTER VIEW monitoring_view_crew OWNER TO postgres;

-- Grant SELECT ke authenticated role supaya bisa di-query dari browser
GRANT SELECT ON monitoring_view_spv  TO authenticated;
GRANT SELECT ON monitoring_view_crew TO authenticated;
GRANT SELECT ON monitoring_view_spv  TO anon;
