-- =============================================================================
-- FIX: monitoring_view_spv & monitoring_view_crew hormati outlet_reorder_point
--
-- Root cause: kedua view menghitung status hanya dari b.default_reorder_point
-- (threshold global per item) dan MENGABAIKAN override per-outlet di tabel
-- outlet_reorder_point. Akibatnya threshold yang di-set per outlet (lewat halaman
-- pengaturan / threshold.ts) tidak pernah memengaruhi status below/warning,
-- sehingga papan SPV & form permintaan crew tidak konsisten dengan ekspektasi.
--
-- Solusi: LEFT JOIN outlet_reorder_point per (outlet_id, bahan_baku_id) dan pakai
-- threshold efektif = COALESCE(orp.reorder_point, b.default_reorder_point, 10).
-- Logika status (below = < threshold/2, warning = < threshold) tetap sama.
-- Tetap SECURITY DEFINER (OWNER postgres) agar bypass RLS stok_balance untuk SPV.
-- =============================================================================

DROP VIEW IF EXISTS monitoring_view_spv;
DROP VIEW IF EXISTS monitoring_view_crew;

-- Guard: tabel outlet_reorder_point dibuat out-of-band di remote (drift riwayat
-- migration) dan tidak pernah terekam di migrations. IF NOT EXISTS membuat
-- migration ini idempotent — di remote dilewati, di DB fresh tabel terbentuk.
CREATE TABLE IF NOT EXISTS outlet_reorder_point (
  outlet_id     UUID NOT NULL REFERENCES outlets(id)    ON DELETE CASCADE,
  bahan_baku_id UUID NOT NULL REFERENCES bahan_baku(id) ON DELETE CASCADE,
  reorder_point NUMERIC NOT NULL,
  updated_by    UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (outlet_id, bahan_baku_id)
);

-- monitoring_view_spv (semua outlet)
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
ORDER BY o.name, b.nama;

ALTER VIEW monitoring_view_spv OWNER TO postgres;

-- monitoring_view_crew (single outlet, filter status di aplikasi)
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
ORDER BY b.nama;

ALTER VIEW monitoring_view_crew OWNER TO postgres;

GRANT SELECT ON monitoring_view_spv  TO authenticated;
GRANT SELECT ON monitoring_view_crew TO authenticated;
GRANT SELECT ON monitoring_view_spv  TO anon;
