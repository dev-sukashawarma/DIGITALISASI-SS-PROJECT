-- Live activity feed untuk papan monitoring SPV (lintas 19 outlet).
-- Mirror pola monitoring_view_spv: view definer (security_barrier, tanpa
-- security_invoker) sehingga authenticated SPV bisa lihat pergerakan stok
-- semua outlet tanpa terbentur RLS ledger_read (yang dibatasi per-outlet).
CREATE OR REPLACE VIEW ledger_feed_spv AS
SELECT
  l.id,
  l.outlet_id,
  o.name        AS outlet_name,
  l.bahan_baku_id,
  b.nama        AS item_name,
  b.satuan,
  l.tipe,
  l.qty,
  l.catatan,
  l.saldo_sesudah,
  l.created_at
FROM ledger_stok l
JOIN outlets o     ON l.outlet_id = o.id
JOIN bahan_baku b  ON l.bahan_baku_id = b.id
ORDER BY l.created_at DESC;

ALTER VIEW ledger_feed_spv SET (security_barrier = on);

-- Index global untuk query feed (ORDER BY created_at DESC LIMIT N lintas outlet).
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger_stok(created_at DESC);
