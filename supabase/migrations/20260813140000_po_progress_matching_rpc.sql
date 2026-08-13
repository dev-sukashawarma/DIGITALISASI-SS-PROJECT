DROP FUNCTION IF EXISTS public.get_purchase_orders(DATE, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.get_purchase_orders(
  p_from   DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_to     DATE DEFAULT CURRENT_DATE,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  id                 UUID,
  nomor_po           TEXT,
  supplier_nama      TEXT,
  tanggal_po         DATE,
  status             TEXT,
  total_nilai        NUMERIC,
  jumlah_item        BIGINT,
  nama_dibuat_oleh   TEXT,
  created_at         TIMESTAMPTZ,
  total_nilai_terima NUMERIC,
  jumlah_item_terima BIGINT,
  jumlah_invoice     INT,
  has_discrepancy    BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    po.id,
    po.nomor_po,
    po.supplier_nama,
    po.tanggal_po,
    po.status,
    COALESCE(SUM(poi.subtotal), 0) AS total_nilai,
    COUNT(poi.id) AS jumlah_item,
    s.name AS nama_dibuat_oleh,
    po.created_at,
    COALESCE(SUM(
      CASE 
        WHEN poi.qty_terima IS NOT NULL THEN (poi.qty_terima * COALESCE(poi.harga_terima, poi.harga_pesan))
        ELSE 0 
      END
    ), 0) AS total_nilai_terima,
    COUNT(CASE WHEN poi.qty_terima IS NOT NULL AND poi.qty_terima > 0 THEN 1 END) AS jumlah_item_terima,
    COALESCE(cardinality(po.invoice_urls), 0) AS jumlah_invoice,
    (
      EXISTS (
        SELECT 1 FROM public.purchase_order_item pi2
        WHERE pi2.purchase_order_id = po.id
          AND (
            (pi2.qty_terima IS NOT NULL AND pi2.qty_terima <> pi2.qty_pesan) OR
            (pi2.harga_terima IS NOT NULL AND pi2.harga_terima <> pi2.harga_pesan) OR
            (pi2.kondisi IN ('rusak', 'kurang'))
          )
      )
    ) AS has_discrepancy
  FROM public.purchase_order po
  LEFT JOIN public.purchase_order_item poi ON poi.purchase_order_id = po.id
  LEFT JOIN public.outlet_staff s ON s.id = po.dibuat_oleh
  WHERE po.tanggal_po BETWEEN p_from AND p_to
    AND (p_status IS NULL OR po.status = p_status)
    AND public.can_manage_po()
  GROUP BY po.id, po.nomor_po, po.supplier_nama, po.tanggal_po,
           po.status, s.name, po.created_at, po.invoice_urls
  ORDER BY po.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_purchase_orders TO authenticated;
