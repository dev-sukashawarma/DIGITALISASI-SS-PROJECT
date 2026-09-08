-- 20300132000000_laporan_kecualikan_outlet_tes.sql
--
-- Mengeluarkan outlet uji developer dari perhitungan laporan.
--
-- ============================================================================
-- ATURAN (keputusan owner, 8 September 2026)
-- ============================================================================
--
--   "outlet tes hanya untuk testing oleh developer, jadi jangan masuk ke
--    perhitungan"
--
-- ============================================================================
-- BESAR MASALAHNYA -- dicatat supaya tak dibesar-besarkan
-- ============================================================================
--
-- Diukur 8 September, omzet 30 hari terakhir:
--
--   outlet   Rp888,1 juta   51,0%
--   mitra    Rp850,9 juta   48,9%
--   test     Rp  0,88 juta    0,051%   <-- kebocorannya
--
-- Waste: 2 laporan dari 298. Dan karena HPP/waste/omzet dikelompokkan PER
-- OUTLET, outlet tes muncul sebagai barisnya sendiri -- ia TIDAK mencemari
-- angka outlet lain. Kerugian nyatanya: satu baris palsu di laporan, plus
-- 0,05% pada total perusahaan.
--
-- Karena itu perbaikannya sengaja dibuat sekecil mungkin: penggantian satu
-- token per fungsi, bukan penulisan ulang isi. Isi keenam fungsi di bawah
-- disalin VERBATIM dari pg_get_functiondef(); satu-satunya perubahan adalah
-- accessible_outlet_ids() -> outlet_ids_terhitung().
--
-- ============================================================================
-- KENAPA HELPER BARU, BUKAN MENGUBAH accessible_outlet_ids()
-- ============================================================================
--
-- accessible_outlet_ids() mengatur HAK BACA (RLS), bukan perhitungan. Kalau
-- outlet tes dikeluarkan dari sana, developer justru tak bisa lagi MELIHAT
-- data ujinya sendiri -- persis merusak gunanya sebagai outlet uji. Aturannya
-- "jangan dihitung", bukan "jangan dilihat".
--
-- outlet_ids_terhitung() = accessible_outlet_ids() minus lokasi non-operasional.
-- Pakai ini di SEMUA agregasi laporan baru. Hak baca tetap lewat yang lama.
--
-- Marketplace (Shopee/TikTok Shop) TIDAK dikecualikan di sini: omzetnya sah
-- dihitung. Yang dikecualikan dari nilai persediaan (20300131000000) adalah
-- soal barang fisik, bukan omzet -- jangan disamakan.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.outlet_ids_terhitung()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.id
  FROM public.outlets o
  WHERE o.id IN (SELECT public.accessible_outlet_ids())
    AND COALESCE(o.type, '') <> 'test';
$function$;

GRANT EXECUTE ON FUNCTION public.outlet_ids_terhitung() TO authenticated;

COMMENT ON FUNCTION public.outlet_ids_terhitung() IS
'Outlet yang boleh diakses DAN layak dihitung di laporan. accessible_outlet_ids() minus outlet uji developer (type=test). Pakai ini untuk agregasi laporan; pakai accessible_outlet_ids() untuk hak baca.';

-- ------------------------------------------------------------------
-- get_hpp_periode
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_hpp_periode(p_from date, p_to date)
 RETURNS TABLE(outlet_id uuid, hpp numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH terjual AS (
    SELECT
      o.outlet_id,
      oi.menu_item_id::text AS menu_item_ref,
      SUM(oi.quantity) as total_qty
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status = 'completed'
      AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
      AND oi.menu_item_id IS NOT NULL
    GROUP BY o.outlet_id, oi.menu_item_id
  ),
  resep_terpilih AS (
    SELECT DISTINCT ON (t.outlet_id, t.menu_item_ref)
      t.outlet_id,
      t.menu_item_ref,
      t.total_qty,
      r.id AS resep_id
    FROM terjual t
    JOIN resep r ON r.menu_item_ref = t.menu_item_ref
    WHERE r.is_active = true
      AND ( (r.scope = 'outlet' AND r.outlet_id = t.outlet_id) OR (r.scope = 'global') )
    ORDER BY t.outlet_id, t.menu_item_ref,
      CASE WHEN r.scope = 'outlet' THEN 1 ELSE 2 END
  ),
  hpp_per_item AS (
    SELECT
      rt.outlet_id,
      -- qty resep (satuan kecil) * harga per satuan kecil.
      -- harga per satuan kecil = harga_beli / kemasan_qty, karena harga_beli
      -- kini selalu per satuan besar dan kemasan_qty = faktor penuh.
      rt.total_qty
        * ri.qty_per_porsi
        * ( COALESCE(bh.harga_beli, 0)
            / COALESCE(
                NULLIF(bh.kemasan_qty, 0),
                NULLIF(
                  CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
                       THEN b.faktor_tampilan
                       ELSE b.faktor_konversi
                  END, 0),
                1) )
        AS biaya_bahan
    FROM resep_terpilih rt
    JOIN resep_item ri ON ri.resep_id = rt.resep_id
    JOIN bahan_baku b ON b.id = ri.bahan_baku_id
    LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id = ri.bahan_baku_id
  ),
  hpp_total AS (
    SELECT outlet_id, SUM(biaya_bahan) AS total_hpp
    FROM hpp_per_item
    GROUP BY outlet_id
  )
  SELECT
    o.id AS outlet_id,
    COALESCE(ht.total_hpp, 0) AS hpp
  FROM outlets o
  LEFT JOIN hpp_total ht ON ht.outlet_id = o.id
  WHERE o.id IN (SELECT public.outlet_ids_terhitung());
$function$;

-- ------------------------------------------------------------------
-- get_hpp_periode_by_channel
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_hpp_periode_by_channel(p_from date, p_to date)
 RETURNS TABLE(outlet_id uuid, sales_source text, hpp numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH terjual AS (
    SELECT
      o.outlet_id,
      o.sales_source,
      oi.menu_item_id::text AS menu_item_ref,
      SUM(oi.quantity) as total_qty
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status = 'completed'
      AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
      AND oi.menu_item_id IS NOT NULL
    GROUP BY o.outlet_id, o.sales_source, oi.menu_item_id
  ),
  resep_terpilih AS (
    SELECT DISTINCT ON (t.outlet_id, t.sales_source, t.menu_item_ref)
      t.outlet_id,
      t.sales_source,
      t.menu_item_ref,
      t.total_qty,
      r.id AS resep_id
    FROM terjual t
    JOIN resep r ON r.menu_item_ref = t.menu_item_ref
    WHERE r.is_active = true
      AND ( (r.scope = 'outlet' AND r.outlet_id = t.outlet_id) OR (r.scope = 'global') )
    ORDER BY t.outlet_id, t.sales_source, t.menu_item_ref,
      CASE WHEN r.scope = 'outlet' THEN 1 ELSE 2 END
  ),
  hpp_per_item AS (
    SELECT
      rt.outlet_id,
      rt.sales_source,
      rt.total_qty
        * ri.qty_per_porsi
        * ( COALESCE(bh.harga_beli, 0)
            / COALESCE(
                NULLIF(bh.kemasan_qty, 0),
                NULLIF(
                  CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
                       THEN b.faktor_tampilan
                       ELSE b.faktor_konversi
                  END, 0),
                1) )
        AS biaya_bahan
    FROM resep_terpilih rt
    JOIN resep_item ri ON ri.resep_id = rt.resep_id
    JOIN bahan_baku b ON b.id = ri.bahan_baku_id
    LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id = ri.bahan_baku_id
  )
  SELECT
    hpp_per_item.outlet_id,
    hpp_per_item.sales_source,
    SUM(hpp_per_item.biaya_bahan) AS hpp
  FROM hpp_per_item
  WHERE hpp_per_item.outlet_id IN (SELECT public.outlet_ids_terhitung())
  GROUP BY hpp_per_item.outlet_id, hpp_per_item.sales_source;
$function$;

-- ------------------------------------------------------------------
-- get_waste_periode
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_waste_periode(p_from date, p_to date)
 RETURNS TABLE(outlet_id uuid, nilai_waste numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  WHERE o.id IN (SELECT public.outlet_ids_terhitung())
  GROUP BY o.id;
$function$;

-- ------------------------------------------------------------------
-- get_waste_breakdown
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_waste_breakdown(p_from date, p_to date)
 RETURNS TABLE(outlet_id uuid, outlet_name text, reason text, bahan_baku_id uuid, bahan_nama text, tanggal date, qty numeric, qty_kecil numeric, satuan_kecil text, hpp_kecil numeric, nilai numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- Faktor PENUH (kecil per besar) -- aturan kanonik yang sama persis dengan
    -- trg_process_bom_stok (20300108000005) dan to_ledger_scale().
    w.qty * GREATEST(
      COALESCE(
        CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
             THEN b.faktor_tampilan
             ELSE b.faktor_konversi
        END,
        1
      ),
      1
    ) AS qty_kecil,
    b.satuan_kecil,
    -- TIDAK DIUBAH (lihat catatan di header): basis harga_beli belum seragam.
    COALESCE(bh.harga_beli, 0) / COALESCE(b.faktor_konversi, 1) AS hpp_kecil,
    w.qty * COALESCE(bh.harga_beli, 0) AS nilai
  FROM stok_waste_reports w
  JOIN outlets o ON o.id = w.outlet_id
  JOIN bahan_baku b ON b.id = w.bahan_baku_id
  LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id = w.bahan_baku_id
  WHERE w.status = 'APPROVED'
    AND (w.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
    AND w.outlet_id IN (SELECT public.outlet_ids_terhitung());
END;
$function$;

-- ------------------------------------------------------------------
-- get_waste_incidents
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_waste_incidents(p_from date, p_to date, p_outlet_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, outlet_id uuid, outlet_name text, bahan_baku_id uuid, bahan_nama text, reason text, qty numeric, qty_kecil numeric, satuan_besar text, satuan_kecil text, hpp_kecil numeric, nilai numeric, photo_url text, reporter_name text, approver_name text, created_at timestamp with time zone, updated_at timestamp with time zone, ledger_row_count bigint, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_limit  int := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Hanya owner/admin yang boleh melihat rincian waste';
  END IF;

  RETURN QUERY
  WITH scoped AS (
    SELECT
      w.id                       AS s_id,
      w.outlet_id                AS s_outlet_id,
      o.name                     AS s_outlet_name,
      w.bahan_baku_id            AS s_bahan_baku_id,
      b.nama                     AS s_bahan_nama,
      w.reason                   AS s_reason,
      w.qty                      AS s_qty,
      b.satuan                   AS s_satuan_besar,
      b.satuan_kecil             AS s_satuan_kecil,
      w.photo_url                AS s_photo_url,
      rep.name                   AS s_reporter_name,
      apr.name                   AS s_approver_name,
      w.created_at               AS s_created_at,
      w.updated_at               AS s_updated_at,
      COALESCE(bh.harga_beli, 0) AS s_harga_beli,
      NULLIF(bh.kemasan_qty, 0)  AS s_kemasan_qty,
      GREATEST(
        COALESCE(
          CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
               THEN b.faktor_tampilan
               ELSE b.faktor_konversi
          END,
          1
        ),
        1
      ) AS s_faktor_penuh
    FROM stok_waste_reports w
    JOIN outlets o    ON o.id = w.outlet_id
    JOIN bahan_baku b ON b.id = w.bahan_baku_id
    LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id = w.bahan_baku_id
    LEFT JOIN outlet_staff rep    ON rep.id = w.reported_by
    LEFT JOIN outlet_staff apr    ON apr.id = w.approved_by
    WHERE w.status = 'APPROVED'
      AND (w.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
      AND w.outlet_id IN (SELECT public.outlet_ids_terhitung())
      AND (p_outlet_id IS NULL OR w.outlet_id = p_outlet_id)
  )
  SELECT
    s.s_id,
    s.s_outlet_id,
    s.s_outlet_name,
    s.s_bahan_baku_id,
    s.s_bahan_nama,
    s.s_reason,
    s.s_qty,
    (s.s_qty * s.s_faktor_penuh)::numeric,
    s.s_satuan_besar,
    s.s_satuan_kecil,
    (s.s_harga_beli / COALESCE(s.s_kemasan_qty, s.s_faktor_penuh))::numeric,
    (s.s_qty * s.s_harga_beli)::numeric,
    s.s_photo_url,
    s.s_reporter_name,
    s.s_approver_name,
    s.s_created_at,
    s.s_updated_at,
    (SELECT COUNT(*) FROM ledger_stok l WHERE l.ref_waste_id = s.s_id)::bigint,
    -- Tanda kurung luar WAJIB: `COUNT(*) OVER ()::bigint` salah parse.
    (COUNT(*) OVER ())::bigint
  FROM scoped s
  ORDER BY s.s_created_at DESC
  LIMIT v_limit OFFSET v_offset;
END;
$function$;

-- ------------------------------------------------------------------
-- get_waste_summary_v2
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_waste_summary_v2(p_from date, p_to date)
 RETURNS TABLE(outlet_id uuid, outlet_name text, bahan_baku_id uuid, bahan_nama text, reason text, tanggal date, qty numeric, qty_kecil numeric, satuan_kecil text, hpp_kecil numeric, nilai numeric, jumlah_insiden bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Hanya owner/admin yang boleh melihat rincian waste';
  END IF;

  RETURN QUERY
  WITH scoped AS (
    SELECT
      w.outlet_id                                   AS s_outlet_id,
      o.name                                        AS s_outlet_name,
      w.bahan_baku_id                               AS s_bahan_baku_id,
      b.nama                                        AS s_bahan_nama,
      w.reason                                      AS s_reason,
      (w.created_at AT TIME ZONE 'Asia/Jakarta')::date AS s_tanggal,
      w.qty                                         AS s_qty,
      b.satuan_kecil                                AS s_satuan_kecil,
      COALESCE(bh.harga_beli, 0)                    AS s_harga_beli,
      NULLIF(bh.kemasan_qty, 0)                     AS s_kemasan_qty,
      -- faktor penuh (kecil per besar) -- ekspresi kanonik, sama persis dengan
      -- 20300120000001, trg_process_bom_stok, dan to_ledger_scale().
      GREATEST(
        COALESCE(
          CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
               THEN b.faktor_tampilan
               ELSE b.faktor_konversi
          END,
          1
        ),
        1
      ) AS s_faktor_penuh
    FROM stok_waste_reports w
    JOIN outlets o     ON o.id = w.outlet_id
    JOIN bahan_baku b  ON b.id = w.bahan_baku_id
    LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id = w.bahan_baku_id
    WHERE w.status = 'APPROVED'
      AND (w.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
      AND w.outlet_id IN (SELECT public.outlet_ids_terhitung())
  )
  SELECT
    s.s_outlet_id,
    s.s_outlet_name,
    s.s_bahan_baku_id,
    s.s_bahan_nama,
    s.s_reason,
    s.s_tanggal,
    SUM(s.s_qty)::numeric,
    SUM(s.s_qty * s.s_faktor_penuh)::numeric,
    s.s_satuan_kecil,
    (s.s_harga_beli / COALESCE(s.s_kemasan_qty, s.s_faktor_penuh))::numeric,
    SUM(s.s_qty * s.s_harga_beli)::numeric,
    COUNT(*)::bigint
  FROM scoped s
  GROUP BY
    s.s_outlet_id, s.s_outlet_name, s.s_bahan_baku_id, s.s_bahan_nama,
    s.s_reason, s.s_tanggal, s.s_satuan_kecil, s.s_harga_beli,
    s.s_kemasan_qty, s.s_faktor_penuh;
END;
$function$;

-- ============================================================================
-- VERIFIKASI SETELAH DITERAPKAN
-- ============================================================================
--
-- 1. Keenam fungsi harus memakai helper baru, nol yang tertinggal:
--
--      SELECT proname,
--             prosrc ILIKE '%outlet_ids_terhitung%'   AS pakai_helper_baru,
--             prosrc ILIKE '%accessible_outlet_ids%'  AS masih_helper_lama
--      FROM pg_proc WHERE proname IN ('get_hpp_periode',
--        'get_hpp_periode_by_channel','get_waste_periode',
--        'get_waste_breakdown','get_waste_incidents','get_waste_summary_v2');
--
-- 2. Helper mengecualikan outlet tes tapi TIDAK mengurangi hak baca:
--
--      SELECT (SELECT count(*) FROM accessible_outlet_ids()) AS bisa_dibaca,
--             (SELECT count(*) FROM outlet_ids_terhitung())  AS ikut_dihitung;
--      -- selisihnya harus tepat sejumlah outlet type=test
--
-- 3. Angka laporan tidak berubah selain hilangnya baris outlet tes.
-- ============================================================================
