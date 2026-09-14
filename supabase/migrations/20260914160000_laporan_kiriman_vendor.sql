-- 20260914160000_laporan_kiriman_vendor.sql
--
-- Laporan kiriman surat jalan per vendor (spec docs/superpowers/specs/2026-09-14-laporan-kiriman-vendor-design.md).
-- _kiriman_vendor_baris = satu sumber aturan baris (fallback vendor katalog, qty acuan,
-- nilai, outlet tes); dua RPC publik membungkusnya dengan cek peran + rentang <= 93 hari.
-- Daftar role WAJIB sama dengan ROLE_LAPORAN_KIRIMAN_VENDOR di apps/stok/src/lib/stok/kirimanVendor.ts.

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public._cek_laporan_kiriman_vendor(p_dari date, p_sampai date)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'role','') <> 'service_role'
     AND COALESCE(public.peran_saya(),'') NOT IN ('kitchen','purchasing','admin','owner','admin_finance','spv','regional_manager') THEN
    RAISE EXCEPTION 'Tidak berhak melihat laporan kiriman vendor' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_dari IS NULL OR p_sampai IS NULL OR p_sampai < p_dari THEN
    RAISE EXCEPTION 'Rentang tanggal tidak valid' USING ERRCODE = 'check_violation';
  END IF;
  IF p_sampai - p_dari > 92 THEN
    RAISE EXCEPTION 'Rentang tanggal maksimal 93 hari' USING ERRCODE = 'check_violation';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._kiriman_vendor_baris(p_dari date, p_sampai date, p_outlet uuid, p_bahan uuid, p_vendor uuid)
RETURNS TABLE(surat_jalan_item_id uuid, surat_jalan_id uuid, tanggal date, document_number text, status text,
  outlet_id uuid, outlet_nama text, outlet_tes boolean, bahan_baku_id uuid, bahan_nama text, satuan text,
  vendor_id uuid, vendor_nama text, vendor_otomatis boolean, qty_dikirim numeric, qty_terima numeric,
  qty_acuan numeric, belum_diterima boolean, harga numeric, nilai numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (
    SELECT i.id AS iid, s.id AS sid, (s.created_at AT TIME ZONE 'Asia/Jakarta')::date AS tgl,
           s.document_number::text AS doc, s.status::text AS st, s.outlet_id AS oid, o.name::text AS onama,
           COALESCE(o.type = 'test', false) AS otes, i.bahan_baku_id AS bid, b.nama::text AS bnama, b.satuan::text AS sat,
           COALESCE(i.vendor_id, f.vid) AS vid, (i.vendor_id IS NULL AND f.vid IS NOT NULL) AS votomatis,
           i.qty_dikirim::numeric AS qd, i.qty_terima::numeric AS qt, i.harga_snapshot::numeric AS hg
      FROM surat_jalan s
      JOIN surat_jalan_item i ON i.surat_jalan_id = s.id
      JOIN outlets o ON o.id = s.outlet_id
      JOIN bahan_baku b ON b.id = i.bahan_baku_id
      LEFT JOIN LATERAL (
        SELECT CASE WHEN count(*) = 1 THEN min(v::text)::uuid END AS vid
          FROM public.vendor_bahan(i.bahan_baku_id) AS v
      ) f ON i.vendor_id IS NULL
     WHERE s.status NOT IN ('draft','dibatalkan')
       AND s.created_at >= (p_dari::timestamp AT TIME ZONE 'Asia/Jakarta')
       AND s.created_at <  ((p_sampai + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
       AND (p_outlet IS NULL OR s.outlet_id = p_outlet)
       AND (p_bahan IS NULL OR i.bahan_baku_id = p_bahan)
  )
  SELECT d.iid, d.sid, d.tgl, d.doc, d.st, d.oid, d.onama, d.otes, d.bid, d.bnama, d.sat,
         d.vid, regexp_replace(sp.nama, '\s*-\s*Tempo\s*\d+\s*$', '', 'i'), COALESCE(d.votomatis, false),
         d.qd, d.qt, COALESCE(d.qt, d.qd), d.qt IS NULL, d.hg, COALESCE(d.qt, d.qd) * d.hg
    FROM d LEFT JOIN supplier sp ON sp.id = d.vid
   WHERE p_vendor IS NULL OR d.vid = p_vendor
$$;

CREATE OR REPLACE FUNCTION public.laporan_kiriman_vendor_rincian(
  p_dari date, p_sampai date, p_outlet uuid DEFAULT NULL, p_bahan uuid DEFAULT NULL,
  p_vendor uuid DEFAULT NULL, p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS TABLE(surat_jalan_item_id uuid, surat_jalan_id uuid, tanggal date, document_number text, status text,
  outlet_id uuid, outlet_nama text, outlet_tes boolean, bahan_baku_id uuid, bahan_nama text, satuan text,
  vendor_id uuid, vendor_nama text, vendor_otomatis boolean, qty_dikirim numeric, qty_terima numeric,
  qty_acuan numeric, belum_diterima boolean, harga numeric, nilai numeric, total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  PERFORM public._cek_laporan_kiriman_vendor(p_dari, p_sampai);
  RETURN QUERY
    SELECT b.*, count(*) OVER ()
      FROM public._kiriman_vendor_baris(p_dari, p_sampai, p_outlet, p_bahan, p_vendor) b
     ORDER BY b.tanggal DESC, b.document_number DESC NULLS LAST, b.bahan_nama, b.surat_jalan_item_id
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END $$;

CREATE OR REPLACE FUNCTION public.laporan_kiriman_vendor_rekap(
  p_dari date, p_sampai date, p_outlet uuid DEFAULT NULL, p_bahan uuid DEFAULT NULL, p_vendor uuid DEFAULT NULL)
RETURNS TABLE(vendor_id uuid, vendor_nama text, bahan_baku_id uuid, bahan_nama text, satuan text,
  outlet_id uuid, outlet_nama text, qty numeric, nilai numeric, harga_rata numeric, jumlah_sj bigint,
  ada_belum_diterima boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  PERFORM public._cek_laporan_kiriman_vendor(p_dari, p_sampai);
  RETURN QUERY
    SELECT b.vendor_id, max(b.vendor_nama), b.bahan_baku_id, max(b.bahan_nama), max(b.satuan),
           b.outlet_id, max(b.outlet_nama), sum(b.qty_acuan), sum(b.nilai),
           sum(b.nilai) / NULLIF(sum(b.qty_acuan) FILTER (WHERE b.harga IS NOT NULL), 0),
           count(DISTINCT b.surat_jalan_id), bool_or(b.belum_diterima)
      FROM public._kiriman_vendor_baris(p_dari, p_sampai, p_outlet, p_bahan, p_vendor) b
     WHERE NOT b.outlet_tes
     GROUP BY b.vendor_id, b.bahan_baku_id, b.outlet_id
     ORDER BY max(b.vendor_nama) NULLS LAST, max(b.bahan_nama), max(b.outlet_nama);
END $$;

REVOKE ALL ON FUNCTION public._cek_laporan_kiriman_vendor(date,date),
  public._kiriman_vendor_baris(date,date,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.laporan_kiriman_vendor_rincian(date,date,uuid,uuid,uuid,int,int),
  public.laporan_kiriman_vendor_rekap(date,date,uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.laporan_kiriman_vendor_rincian(date,date,uuid,uuid,uuid,int,int),
  public.laporan_kiriman_vendor_rekap(date,date,uuid,uuid,uuid) TO authenticated, service_role;
