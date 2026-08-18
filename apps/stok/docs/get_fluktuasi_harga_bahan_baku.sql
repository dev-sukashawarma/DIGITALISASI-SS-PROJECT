-- ==============================================================================
-- Function: get_fluktuasi_harga_bahan_baku
-- Deskripsi: Menghitung harga beli PO terakhir vs PO sebelumnya vs Harga Master
--            untuk seluruh bahan baku dengan window function PostgreSQL.
-- ==============================================================================

CREATE OR REPLACE FUNCTION get_fluktuasi_harga_bahan_baku(
  p_days integer DEFAULT NULL,
  p_kategori_id uuid DEFAULT NULL
)
RETURNS TABLE (
  bahan_baku_id uuid,
  kode text,
  nama text,
  satuan text,
  kategori_id uuid,
  kategori_nama text,
  harga_master numeric,
  harga_terakhir numeric,
  tgl_po_terakhir date,
  nomor_po_terakhir text,
  supplier_terakhir text,
  po_id_terakhir uuid,
  harga_sebelumnya numeric,
  tgl_po_sebelumnya date,
  nomor_po_sebelumnya text,
  supplier_sebelumnya text,
  po_id_sebelumnya uuid,
  selisih_nominal_prev numeric,
  selisih_pct_prev numeric,
  selisih_nominal_master numeric,
  selisih_pct_master numeric,
  total_transaksi_po bigint,
  trend_prices numeric[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH valid_po_items AS (
    SELECT 
      poi.bahan_baku_id,
      poi.harga_terima,
      po.id AS po_id,
      po.nomor_po,
      po.supplier_nama,
      po.tanggal_po,
      ROW_NUMBER() OVER (
        PARTITION BY poi.bahan_baku_id 
        ORDER BY po.tanggal_po DESC, po.created_at DESC
      ) as rn
    FROM purchase_order_item poi
    JOIN purchase_order po ON po.id = poi.purchase_order_id
    WHERE po.status IN ('diterima_lengkap', 'sebagian_diterima')
      AND poi.harga_terima IS NOT NULL
      AND poi.harga_terima > 0
      AND (p_days IS NULL OR po.tanggal_po >= (CURRENT_DATE - (p_days || ' days')::interval))
  ),
  ranked_items AS (
    SELECT
      v.bahan_baku_id,
      -- Transaksi Terakhir (rn = 1)
      MAX(CASE WHEN v.rn = 1 THEN v.harga_terima END) AS h_terakhir,
      MAX(CASE WHEN v.rn = 1 THEN v.tanggal_po END) AS tgl_terakhir,
      MAX(CASE WHEN v.rn = 1 THEN v.nomor_po END) AS no_po_terakhir,
      MAX(CASE WHEN v.rn = 1 THEN v.supplier_nama END) AS supp_terakhir,
      MAX(CASE WHEN v.rn = 1 THEN v.po_id END) AS po_id_terakhir,
      -- Transaksi Sebelumnya (rn = 2)
      MAX(CASE WHEN v.rn = 2 THEN v.harga_terima END) AS h_sebelumnya,
      MAX(CASE WHEN v.rn = 2 THEN v.tanggal_po END) AS tgl_sebelumnya,
      MAX(CASE WHEN v.rn = 2 THEN v.nomor_po END) AS no_po_sebelumnya,
      MAX(CASE WHEN v.rn = 2 THEN v.supplier_nama END) AS supp_sebelumnya,
      MAX(CASE WHEN v.rn = 2 THEN v.po_id END) AS po_id_sebelumnya,
      COUNT(v.po_id) AS total_tx,
      -- Ambil hingga 8 data poin harga untuk sparkline (dibalik urut kronologis)
      ARRAY_AGG(v.harga_terima ORDER BY v.tanggal_po ASC) FILTER (WHERE v.rn <= 8) AS raw_trends
    FROM valid_po_items v
    GROUP BY v.bahan_baku_id
  )
  SELECT 
    bb.id AS bahan_baku_id,
    COALESCE(bb.kode, '') AS kode,
    bb.nama,
    COALESCE(bb.kategori, bb.kategori_core, 'Lainnya') AS kategori_nama,
    bbh.harga_beli AS harga_master,
    r.h_terakhir AS harga_terakhir,
    r.tgl_terakhir AS tgl_po_terakhir,
    r.no_po_terakhir AS nomor_po_terakhir,
    r.supp_terakhir AS supplier_terakhir,
    r.po_id_terakhir,
    r.h_sebelumnya AS harga_sebelumnya,
    r.tgl_sebelumnya AS tgl_po_sebelumnya,
    r.no_po_sebelumnya AS nomor_po_sebelumnya,
    r.supp_sebelumnya AS supplier_sebelumnya,
    r.po_id_sebelumnya,
    -- Selisih vs Prev
    CASE 
      WHEN r.h_terakhir IS NOT NULL AND r.h_sebelumnya IS NOT NULL 
      THEN (r.h_terakhir - r.h_sebelumnya)
      ELSE NULL
    END AS selisih_nominal_prev,
    CASE 
      WHEN r.h_terakhir IS NOT NULL AND r.h_sebelumnya IS NOT NULL AND r.h_sebelumnya > 0
      THEN ROUND(((r.h_terakhir - r.h_sebelumnya) / r.h_sebelumnya)::numeric, 4)
      ELSE NULL
    END AS selisih_pct_prev,
    -- Selisih vs Master
    CASE 
      WHEN r.h_terakhir IS NOT NULL AND bbh.harga_beli IS NOT NULL 
      THEN (r.h_terakhir - bbh.harga_beli)
      ELSE NULL
    END AS selisih_nominal_master,
    CASE 
      WHEN r.h_terakhir IS NOT NULL AND bbh.harga_beli IS NOT NULL AND bbh.harga_beli > 0
      THEN ROUND(((r.h_terakhir - bbh.harga_beli) / bbh.harga_beli)::numeric, 4)
      ELSE NULL
    END AS selisih_pct_master,
    COALESCE(r.total_tx, 0) AS total_transaksi_po,
    COALESCE(r.raw_trends, ARRAY[]::numeric[]) AS trend_prices
  FROM bahan_baku bb
  LEFT JOIN bahan_baku_harga bbh ON bbh.bahan_baku_id = bb.id
  LEFT JOIN ranked_items r ON r.bahan_baku_id = bb.id
  WHERE bb.is_active = true
  ORDER BY 
    CASE 
      WHEN r.h_terakhir IS NOT NULL AND r.h_sebelumnya IS NOT NULL THEN ABS(r.h_terakhir - r.h_sebelumnya) 
      ELSE 0 
    END DESC,
    bb.nama ASC;
END;
$$;
