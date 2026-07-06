-- 20260707100700_po_reporting_view.sql
-- View laporan pembelian supplier untuk analitik dan monitoring HPP level kitchen.
--
-- pembelian_supplier_harian_spv:
--   Agregasi pembelian per bahan per hari (hanya PO yang sudah diverifikasi).
--   Dipakai untuk:
--     - Laporan pengeluaran bahan baku bulanan level perusahaan
--     - Perbandingan harga beli antar supplier (jika supplier diisi)
--     - Future: ganti sumber hpp_barang_masuk di level kitchen dari SJ ke PO

CREATE OR REPLACE VIEW public.pembelian_supplier_harian_spv AS
SELECT
  (po.diverifikasi_at AT TIME ZONE 'Asia/Jakarta')::DATE  AS tanggal,
  po.id                                                    AS purchase_order_id,
  po.nomor_po,
  po.supplier_id,
  po.supplier_nama,
  poi.bahan_baku_id,
  b.nama                                                   AS nama_bahan,
  b.satuan,
  poi.qty_terima,
  poi.harga_terima,
  poi.subtotal                                             AS nilai_beli,
  poi.kondisi
FROM public.purchase_order po
JOIN public.purchase_order_item poi ON poi.purchase_order_id = po.id
JOIN public.bahan_baku b            ON b.id = poi.bahan_baku_id
WHERE po.status IN ('sebagian_diterima', 'diterima_lengkap')
  AND poi.qty_terima IS NOT NULL;

GRANT SELECT ON public.pembelian_supplier_harian_spv TO authenticated;

-- ============================================================
-- Agregasi bulanan per bahan (untuk tren harga)
-- ============================================================
CREATE OR REPLACE VIEW public.pembelian_supplier_bulanan AS
SELECT
  DATE_TRUNC('month', (po.diverifikasi_at AT TIME ZONE 'Asia/Jakarta'))::DATE AS bulan,
  poi.bahan_baku_id,
  b.nama                AS nama_bahan,
  b.satuan,
  po.supplier_id,
  po.supplier_nama,
  SUM(poi.qty_terima)   AS total_qty,
  -- Rata-rata harga tertimbang (weighted average price)
  ROUND(
    SUM(poi.qty_terima * COALESCE(poi.harga_terima, 0))
    / NULLIF(SUM(poi.qty_terima), 0),
  0)                    AS avg_harga_tertimbang,
  MIN(poi.harga_terima) AS harga_min,
  MAX(poi.harga_terima) AS harga_max,
  SUM(poi.subtotal)     AS total_nilai,
  COUNT(po.id)          AS jumlah_po
FROM public.purchase_order po
JOIN public.purchase_order_item poi ON poi.purchase_order_id = po.id
JOIN public.bahan_baku b            ON b.id = poi.bahan_baku_id
WHERE po.status IN ('sebagian_diterima', 'diterima_lengkap')
  AND poi.qty_terima IS NOT NULL
  AND poi.harga_terima IS NOT NULL
GROUP BY 1, 2, 3, 4, 5, 6;

GRANT SELECT ON public.pembelian_supplier_bulanan TO authenticated;

-- DOWN:
-- DROP VIEW IF EXISTS public.pembelian_supplier_harian_spv;
-- DROP VIEW IF EXISTS public.pembelian_supplier_bulanan;
