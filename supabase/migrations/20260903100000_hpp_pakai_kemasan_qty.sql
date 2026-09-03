-- 20260903100000_hpp_pakai_kemasan_qty.sql
--
-- Menyelaraskan file migration dengan fungsi yang SUDAH berjalan di produksi.
--
-- Latar: get_hpp_periode & get_hpp_periode_by_channel sempat membagi harga dengan
-- faktor_konversi. Itu keliru: harga_beli disimpan per SATUAN BESAR (Dus, Kompan,
-- Bal), dan jumlah satuan kecil di dalamnya ada di bahan_baku_harga.kemasan_qty --
-- bukan di faktor_konversi. Contoh: 1 Dus KENTANG = 10.000 gram seharga Rp250.000,
-- tapi faktor_konversi-nya 1.000, sehingga biaya kentang terhitung 10x lipat.
--
-- Perbaikan sudah diterapkan LANGSUNG ke database produksi (tanpa migration), jadi
-- fungsi live sudah benar. Tapi ketiga file yang mendefinisikan fungsi ini
-- (20260701120000, 20260708225000, 20260720100000) masih berisi rumus lama. Kalau
-- database dibangun ulang dari migration, rumus salah itu hidup lagi TANPA error --
-- HPP hanya diam-diam membengkak. Proyek ini sudah pernah kehilangan versi fungsi
-- secara senyap lewat CREATE OR REPLACE bernama sama (lihat 20260708225000 yang
-- menimpa 20260701120000).
--
-- Isi kedua fungsi di bawah disalin VERBATIM dari pg_get_functiondef() pada
-- 2026-09-03. Karena identik dengan yang sudah berjalan, migration ini adalah
-- no-op fungsional: tidak ada satu angka pun yang berubah.
--
-- Pembagi memakai COALESCE berjenjang: kemasan_qty -> faktor_tampilan/faktor_konversi
-- -> 1, sehingga bahan yang kemasan_qty-nya belum diisi tetap berperilaku seperti
-- sebelumnya (aman, tidak ada perubahan mendadak).
--
-- CATATAN: get_waste_periode & get_waste_breakdown MASIH memakai faktor_konversi.
-- Sengaja tidak disentuh di sini; dicatat sebagai pekerjaan terpisah.

-- ============================================================
-- 1. get_hpp_periode
-- ============================================================
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
  WHERE o.id IN (SELECT public.accessible_outlet_ids());
$function$;

-- ============================================================
-- 2. get_hpp_periode_by_channel
-- ============================================================

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
  WHERE hpp_per_item.outlet_id IN (SELECT public.accessible_outlet_ids())
  GROUP BY hpp_per_item.outlet_id, hpp_per_item.sales_source;
$function$;

GRANT EXECUTE ON FUNCTION public.get_hpp_periode(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hpp_periode_by_channel(date, date) TO authenticated;
