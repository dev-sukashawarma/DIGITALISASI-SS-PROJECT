-- 20260723100200_purchase_suggestion_view.sql
-- Usulan beli untuk Gudang Pusat. Data mentah; aritmetika qty saran ada di TS
-- (apps/admin-dashboard/src/lib/purchase/suggestion.ts).
--
-- KOREKSI vs plan (berdasarkan ground-truth DB live 2026-07-25):
--  1) Gudang Pusat = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90' ("GUDANG PUSAT (HQ)"),
--     BUKAN '550e8400-...' (itu outlet "SUKA SHAWARMA BNR"). Konsisten dgn
--     po_on_verified() live yang menulis ledger stok PO ke outlet HQ ini.
--  2) monitoring_view_spv kolom nyata: item_name (nama), current_qty (stok), threshold.
--  3) Permintaan item ada di permintaan_bahan_item (permintaan_id, bahan_baku_id,
--     qty_diminta); permintaan_bahan hanya header. Status pending = 'menunggu'.
--  4) SECURITY DEFINER (bukan security_invoker) — pola sama _spv lain; agar purchase
--     tak perlu SELECT langsung ke tiap sumber (permintaan_bahan_item dll). View
--     ter-scope 1 outlet & read-only; gerbang akses = GRANT + role guard di app.

CREATE OR REPLACE VIEW public.purchase_suggestion_spv AS
WITH pesan AS (
  -- Qty yang sudah dipesan tapi belum datang (cegah saran dobel).
  SELECT poi.bahan_baku_id,
         COALESCE(SUM(poi.qty_pesan - COALESCE(poi.qty_terima, 0)), 0) AS sudah_dipesan
  FROM public.purchase_order_item poi
  JOIN public.purchase_order po ON po.id = poi.purchase_order_id
  WHERE po.status IN ('menunggu_approval_finance', 'dikirim_ke_supplier', 'sebagian_diterima')
  GROUP BY poi.bahan_baku_id
),
minta AS (
  -- Permintaan outlet yang belum terpenuhi (status header = 'menunggu').
  SELECT pbi.bahan_baku_id,
         COALESCE(SUM(pbi.qty_diminta), 0) AS permintaan_pending
  FROM public.permintaan_bahan_item pbi
  JOIN public.permintaan_bahan pb ON pb.id = pbi.permintaan_id
  WHERE pb.status = 'menunggu'
  GROUP BY pbi.bahan_baku_id
)
SELECT
  m.bahan_baku_id,
  m.item_name                            AS nama,
  m.satuan,
  m.current_qty                          AS stok,
  m.threshold,
  f.days_left,
  COALESCE(minta.permintaan_pending, 0)  AS permintaan_pending,
  COALESCE(pesan.sudah_dipesan, 0)       AS sudah_dipesan
FROM public.monitoring_view_spv m
LEFT JOIN public.stockout_forecast_spv f
       ON f.bahan_baku_id = m.bahan_baku_id AND f.outlet_id = m.outlet_id
LEFT JOIN pesan ON pesan.bahan_baku_id = m.bahan_baku_id
LEFT JOIN minta ON minta.bahan_baku_id = m.bahan_baku_id
WHERE m.outlet_id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90';

GRANT SELECT ON public.purchase_suggestion_spv TO authenticated;

-- Policy: purchase boleh baca status bayar PO (read-only) untuk jaga hubungan supplier.
DROP POLICY IF EXISTS po_select_purchase ON public.purchase_order;
CREATE POLICY po_select_purchase ON public.purchase_order
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role = 'purchase'));

DROP POLICY IF EXISTS poi_select_purchase ON public.purchase_order_item;
CREATE POLICY poi_select_purchase ON public.purchase_order_item
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role = 'purchase'));
