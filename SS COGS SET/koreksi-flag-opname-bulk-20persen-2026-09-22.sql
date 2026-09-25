-- Koreksi flag opname_item September 2026 ke aturan toleransi baru
-- (Bulk 20%, AYAM/SAPI 40%, KENTANG 20%, Count 0% -- keputusan owner 22 Sep).
-- Opname disimpan sebelum aturan di-deploy masih bertanda "Melebihi
-- Toleransi" dengan aturan lama 5%. Hanya kolom flagged; stok/ledger tak
-- disentuh. Agustus sengaja dilewati (aturan owner). Idempoten.
-- Aturan HARUS sama dengan getThresholdPersen (apps/stok/src/lib/stok/selisih.ts).
UPDATE opname_item oi SET flagged = false
FROM opname o, bahan_baku b
WHERE o.id = oi.opname_id
  AND b.id = oi.bahan_baku_id
  AND o.created_at >= '2026-09-01'
  AND oi.flagged
  AND oi.qty_fisik IS NOT NULL
  AND oi.qty_system <> 0
  AND abs(oi.selisih) <= (
    CASE
      WHEN upper(trim(b.nama)) IN ('SAPI','AYAM') THEN 40
      WHEN upper(trim(b.nama)) = 'KENTANG' THEN 20
      WHEN b.satuan IS NULL THEN 15
      WHEN lower(b.satuan) IN ('gram','ml','kg','liter') THEN 20
      WHEN lower(coalesce(b.satuan_kecil,'')) IN ('gram','ml','liter') AND lower(b.satuan) <> 'pcs' THEN 20
      ELSE 0
    END / 100.0) * abs(oi.qty_system);
