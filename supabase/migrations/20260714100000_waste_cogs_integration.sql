-- 20260714100000_waste_cogs_integration.sql
-- Reporting RPCs di atas stok_waste_reports (yang sudah ada, tak diubah).
-- Nilai waste dihitung dalam Rupiah dari waste APPROVED, berbasis harga bahan
-- baku SAAT INI (bahan_baku_harga.harga_beli / faktor_konversi) -- bukan
-- snapshot harga pada saat waste dilaporkan.
-- get_waste_periode: total per outlet, scoped via accessible_outlet_ids(), untuk semua authenticated user.
-- get_waste_breakdown: rincian granular per baris, HANYA owner/admin (dicek di dalam fungsi via is_owner_or_admin()).

CREATE OR REPLACE FUNCTION get_waste_periode(p_from date, p_to date)
RETURNS TABLE(outlet_id uuid, nilai_waste numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH waste_valued AS (
    SELECT
      w.outlet_id,
      w.qty * COALESCE(bh.harga_beli, 0) AS nilai
    FROM stok_waste_reports w
    JOIN bahan_baku b ON b.id = w.bahan_baku_id
    LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id = w.bahan_baku_id
    WHERE w.status = 'APPROVED'
      AND (w.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
  )
  SELECT o.id AS outlet_id, COALESCE(SUM(wv.nilai), 0) AS nilai_waste
  FROM outlets o
  LEFT JOIN waste_valued wv ON wv.outlet_id = o.id
  WHERE o.id IN (SELECT public.accessible_outlet_ids())
  GROUP BY o.id;
$$;

GRANT EXECUTE ON FUNCTION get_waste_periode(date, date) TO authenticated;

DROP FUNCTION IF EXISTS get_waste_breakdown(date, date);

CREATE OR REPLACE FUNCTION get_waste_breakdown(p_from date, p_to date)
RETURNS TABLE(
  outlet_id uuid,
  outlet_name text,
  reason text,
  bahan_baku_id uuid,
  bahan_nama text,
  tanggal date,
  qty numeric,
  qty_kecil numeric,
  satuan_kecil text,
  hpp_kecil numeric,
  nilai numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Hanya owner/admin yang boleh melihat rincian waste';
  END IF;

  RETURN QUERY
  SELECT
    w.outlet_id,
    o.name AS outlet_name,
    w.reason,
    w.bahan_baku_id,
    b.nama AS bahan_nama,
    (w.created_at AT TIME ZONE 'Asia/Jakarta')::date AS tanggal,
    w.qty,
    w.qty * COALESCE(b.faktor_konversi, 1) AS qty_kecil,
    b.satuan_kecil,
    COALESCE(bh.harga_beli, 0) / COALESCE(b.faktor_konversi, 1) AS hpp_kecil,
    w.qty * COALESCE(bh.harga_beli, 0) AS nilai
  FROM stok_waste_reports w
  JOIN outlets o ON o.id = w.outlet_id
  JOIN bahan_baku b ON b.id = w.bahan_baku_id
  LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id = w.bahan_baku_id
  WHERE w.status = 'APPROVED'
    AND (w.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
    AND w.outlet_id IN (SELECT public.accessible_outlet_ids());
END;
$$;

GRANT EXECUTE ON FUNCTION get_waste_breakdown(date, date) TO authenticated;
