-- supabase/migrations/20260915220000_harga_bahan_efektif.sql
-- Spec §2 (harga bertingkat) & §7. Harga diselesaikan saat DIBACA.
BEGIN;

CREATE OR REPLACE FUNCTION public.can_view_hpp_dinamis()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(auth.jwt()->>'role' = 'service_role', false)
      OR EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND status = 'active'
                   AND role IN ('kitchen','purchasing','admin_finance','admin','owner',
                                'spv','regional_manager','leader','area_manager','developer'));
$$;
REVOKE ALL ON FUNCTION public.can_view_hpp_dinamis() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_hpp_dinamis() TO authenticated;

CREATE OR REPLACE FUNCTION public.harga_bahan_efektif(p_outlet uuid, p_bahan uuid, p_tanggal date)
RETURNS TABLE(harga_besar numeric, harga_kecil numeric, sumber_harga text, ref_id uuid, ref_tanggal date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pembagi AS (
    SELECT COALESCE(NULLIF(bh.kemasan_qty,0),
             NULLIF(CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
                         THEN b.faktor_tampilan ELSE b.faktor_konversi END,0), 1) AS d
    FROM public.bahan_baku b
    LEFT JOIN public.bahan_baku_harga bh ON bh.bahan_baku_id = b.id
    WHERE b.id = p_bahan
  ),
  kandidat AS (
    -- 1. kiriman terverifikasi terakhir (manusia ATAU auto) ke outlet ini
    SELECT 1 AS prio, sji.harga_snapshot AS h, 'kiriman'::text AS s, sj.id AS rid,
           (COALESCE(sji.verified_at, sj.auto_verified_at, sj.created_at) AT TIME ZONE 'Asia/Jakarta')::date AS rt,
           COALESCE(sji.verified_at, sj.auto_verified_at, sj.created_at) AS ts
    FROM public.surat_jalan_item sji
    JOIN public.surat_jalan sj ON sj.id = sji.surat_jalan_id
    WHERE sj.outlet_id = p_outlet AND sji.bahan_baku_id = p_bahan
      AND sji.qty_terima IS NOT NULL AND sji.qty_terima > 0
      AND COALESCE(sji.harga_snapshot,0) > 0
      AND (COALESCE(sji.verified_at, sj.auto_verified_at, sj.created_at) AT TIME ZONE 'Asia/Jakarta')::date <= p_tanggal
    UNION ALL
    -- 2. drop-ship vendor ke outlet ini
    SELECT 2, tvo.harga_snapshot, 'drop_ship', tvo.id, tvo.tanggal_terima, tvo.dicatat_at
    FROM public.terima_vendor_outlet tvo
    WHERE tvo.outlet_id = p_outlet AND tvo.bahan_baku_id = p_bahan
      AND COALESCE(tvo.harga_snapshot,0) > 0 AND tvo.tanggal_terima <= p_tanggal
      AND tvo.status <> 'ditolak'
    UNION ALL
    -- 3. riwayat master (hanya baris yang benar-benar mengubah harga)
    SELECT 3, h.harga_baru, 'master_historis', h.id,
           (h.changed_at AT TIME ZONE 'Asia/Jakarta')::date, h.changed_at
    FROM public.bahan_baku_harga_history h
    WHERE h.bahan_baku_id = p_bahan AND COALESCE(h.harga_baru,0) > 0
      AND h.harga_lama IS DISTINCT FROM h.harga_baru
      AND (h.changed_at AT TIME ZONE 'Asia/Jakarta')::date <= p_tanggal
    UNION ALL
    -- 4. master sekarang
    SELECT 4, bh.harga_beli, 'master_sekarang', NULL::uuid, NULL::date, NULL::timestamptz
    FROM public.bahan_baku_harga bh
    WHERE bh.bahan_baku_id = p_bahan AND COALESCE(bh.harga_beli,0) > 0
  ),
  pilih AS (SELECT * FROM kandidat ORDER BY prio, ts DESC NULLS LAST LIMIT 1)
  SELECT COALESCE(p.h, 0), COALESCE(p.h, 0) / pb.d, COALESCE(p.s, 'tidak_ada'), p.rid, p.rt
  FROM pembagi pb LEFT JOIN pilih p ON true;
$$;
REVOKE ALL ON FUNCTION public.harga_bahan_efektif(uuid,uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.harga_bahan_efektif(uuid,uuid,date) TO authenticated;

DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.harga_bahan_efektif'::regproc) INTO v_def;
  IF v_def NOT LIKE '%SECURITY DEFINER%' OR v_def NOT LIKE '%search_path%' THEN
    RAISE EXCEPTION 'ASERSI GAGAL: harga_bahan_efektif bukan DEFINER/search_path';
  END IF;
END $$;
COMMIT;
