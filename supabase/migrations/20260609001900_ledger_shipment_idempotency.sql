-- Prevent duplicate terima_kiriman entries from the same shipment.
-- If ledger-create-from-shipment is called twice (network retry, M3 double-call),
-- the second call silently does nothing instead of doubling the balance.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_shipment_item
  ON ledger_stok (ref_shipment_id, bahan_baku_id)
  WHERE ref_shipment_id IS NOT NULL AND tipe = 'terima_kiriman';
