CREATE OR REPLACE FUNCTION calculate_bahan_baku_request(
  p_outlet_id UUID,
  p_targets JSONB
)
RETURNS TABLE (
  bahan_baku_id UUID,
  nama_bahan TEXT,
  satuan TEXT,
  kebutuhan NUMERIC,
  sisa_stok NUMERIC,
  saran_qty NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH targets AS (
    SELECT
      (value->>'resep_id')::UUID AS resep_id,
      (value->>'qty_target')::NUMERIC AS qty_target
    FROM jsonb_array_elements(p_targets)
  ),
  kebutuhan_bahan AS (
    SELECT
      ri.bahan_baku_id,
      SUM(ri.qty_per_porsi * t.qty_target) AS total_kebutuhan_kecil
    FROM targets t
    JOIN resep_item ri ON ri.resep_id = t.resep_id
    GROUP BY ri.bahan_baku_id
  )
  SELECT
    k.bahan_baku_id,
    b.nama AS nama_bahan,
    b.satuan,
    ROUND(k.total_kebutuhan_kecil / COALESCE(b.faktor_konversi, 1), 2) AS kebutuhan,
    COALESCE(sb.saldo, 0) AS sisa_stok,
    CEIL(GREATEST(0, (k.total_kebutuhan_kecil / COALESCE(b.faktor_konversi, 1)) - COALESCE(sb.saldo, 0))) AS saran_qty
  FROM kebutuhan_bahan k
  JOIN bahan_baku b ON b.id = k.bahan_baku_id
  LEFT JOIN stok_balance sb ON sb.bahan_baku_id = k.bahan_baku_id AND sb.outlet_id = p_outlet_id;
END;
$$;
