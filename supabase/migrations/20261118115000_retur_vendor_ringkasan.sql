-- Ringkasan kualitas vendor: retur + penolakan saat terima PO (2026-11-18), Plan Task 9.
-- Per vendor induk & alasan. Retur dihitung per diajukan_at (WIB), status selain
-- ditolak/dibatalkan. Penolakan per purchase_order.tanggal_po, nilai = qty_ditolak × harga.

CREATE OR REPLACE FUNCTION public.ringkasan_kualitas_vendor(p_dari date, p_sampai date)
RETURNS TABLE (
  vendor_induk uuid, vendor_nama text, alasan text,
  jumlah_retur int, nilai_retur numeric, nilai_tidak_dikompensasi numeric,
  jumlah_baris_tolak int, nilai_tolak numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (retur_vendor_peran_ok('ajukan') OR retur_vendor_peran_ok('putus')) THEN
    RAISE EXCEPTION 'Tidak berhak melihat ringkasan kualitas vendor' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  WITH retur AS (
    SELECT r.vendor_induk AS induk, i.alasan AS als, r.id AS rid,
           i.subtotal AS nilai, r.nilai_tidak_dikompensasi AS tdk
    FROM retur_vendor r JOIN retur_vendor_item i ON i.retur_vendor_id = r.id
    WHERE r.status NOT IN ('ditolak','dibatalkan')
      AND (r.diajukan_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_dari AND p_sampai
  ), retur_agg AS (
    SELECT induk, als, count(DISTINCT rid)::int AS n, SUM(nilai) AS nilai,
           -- nilai_tidak_dikompensasi milik dokumen; dibagi rata ke item agar tidak terhitung ganda
           SUM(tdk / NULLIF((SELECT count(*) FROM retur_vendor_item x WHERE x.retur_vendor_id = rid), 0)) AS tdk
    FROM retur GROUP BY induk, als
  ), tolak AS (
    SELECT vendor_induk(po.supplier_id) AS induk, poi.alasan_tolak AS als,
           count(*)::int AS n, SUM(poi.qty_ditolak * COALESCE(poi.harga_terima, poi.harga_pesan, 0)) AS nilai
    FROM purchase_order_item poi JOIN purchase_order po ON po.id = poi.purchase_order_id
    WHERE poi.qty_ditolak > 0 AND po.supplier_id IS NOT NULL
      AND po.tanggal_po BETWEEN p_dari AND p_sampai
    GROUP BY 1, 2
  )
  SELECT COALESCE(a.induk, t.induk),
         regexp_replace(s.nama, '\s*-\s*Tempo\s*\d+\s*$', '', 'i'),
         COALESCE(a.als, t.als),
         COALESCE(a.n, 0), COALESCE(a.nilai, 0), COALESCE(a.tdk, 0),
         COALESCE(t.n, 0), COALESCE(t.nilai, 0)
  FROM retur_agg a
  FULL JOIN tolak t ON t.induk = a.induk AND t.als IS NOT DISTINCT FROM a.als
  LEFT JOIN supplier s ON s.id = COALESCE(a.induk, t.induk)
  ORDER BY COALESCE(a.nilai, 0) + COALESCE(t.nilai, 0) DESC;
END $$;
REVOKE ALL ON FUNCTION public.ringkasan_kualitas_vendor(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ringkasan_kualitas_vendor(date, date) TO authenticated;
