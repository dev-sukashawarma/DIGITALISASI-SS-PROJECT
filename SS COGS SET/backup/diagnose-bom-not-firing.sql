-- diagnose-bom-not-firing.sql
-- Ganti '<order_id>' dengan id order yang barusan di-test (lihat di UI kasir / tabel orders).
-- Kalau tidak tahu id-nya, jalankan dulu:
--   SELECT id, order_number, outlet_id, status, created_at FROM orders
--   WHERE outlet_id = '550e8400-e29b-41d4-a716-446655440002' ORDER BY created_at DESC LIMIT 5;

WITH target AS (
  SELECT '<order_id>'::uuid AS order_id
)
SELECT
  o.id AS order_id,
  o.status AS order_status,
  o.outlet_id,
  (o.outlet_id::text = '550e8400-e29b-41d4-a716-446655440002') AS outlet_adalah_empang,
  oi.id AS order_item_id,
  oi.menu_item_id,
  oi.menu_item_name,
  oi.quantity,
  (oi.menu_item_id IS NULL) AS menu_item_id_kosong,  -- kalau TRUE, ini penyebabnya
  r.id AS resep_id,
  r.nama AS resep_nama,
  r.is_active AS resep_aktif,
  r.menu_item_ref,
  (r.menu_item_ref = oi.menu_item_id::text) AS ref_cocok,
  gs.value AS allowlist_value,
  (o.outlet_id::text = ANY (string_to_array(gs.value, ','))) AS outlet_di_allowlist,
  EXISTS (SELECT 1 FROM ledger_stok l WHERE l.ref_order_id = o.id) AS ada_ledger
FROM target t
JOIN orders o ON o.id = t.order_id
LEFT JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN resep r ON r.menu_item_ref = oi.menu_item_id::text AND r.is_active = true AND r.scope = 'global'
LEFT JOIN global_settings gs ON gs.key = 'bom_automation_allowed_outlets';
