-- 20300122000002_hpp_periode_pakai_kemasan_qty.sql
--
-- Menutup sisa terakhir dari normalisasi basis harga (20300122000000/000001).
--
-- MASALAH
--   get_hpp_periode dan get_hpp_periode_by_channel menghitung biaya bahan dengan
--       qty_per_porsi / COALESCE(b.faktor_konversi, 1) * harga_beli
--   Pembagi itu benar HANYA ketika harga_beli kebetulan tersimpan per satuan
--   tengah -- asumsi lama yang sudah tidak berlaku. Sejak normalisasi,
--   harga_beli selalu per SATUAN BESAR dan kemasan_qty berisi faktor penuh,
--   sehingga harga per satuan kecil = harga_beli / kemasan_qty.
--
--   Dengan pembagi lama, HPP 20 menu meleset +160% terhadap hpp_override
--   (mis. satu porsi Shawarma Mix Jumbo dihitung Rp79.899 padahal harga jualnya
--   Rp47.000, karena KENTANG dihitung Rp40.000 dan MINYAK Rp13.160 per porsi).
--
-- PERBAIKAN
--   Pembagi -> kemasan_qty. Kalau kemasan_qty kosong, jatuh ke faktor penuh
--   (ekspresi kanonik yang sama dengan trg_process_bom_stok, to_ledger_scale,
--   get_waste_breakdown, dan sync_harga_beli_display), baru terakhir ke 1.
--
-- KRITERIA PENERIMAAN (sudah dihitung di luar DB sebelum migration ini ditulis,
-- memakai rumus yang sama persis dan harga yang kini tersimpan):
--   total HPP 20 menu  Rp308.844 terhadap hpp_override Rp326.600  = -5,4%
--   food cost rata-rata 53%, rentang 52%-68% untuk menu utama
--   18 dari 20 menu meleset <12%; dua sisanya (Extra Keju -66%, Extra Kentang
--   -86%) penyebabnya kuantitas resep, bukan harga.
--   Kalau hasil setelah apply jauh dari angka ini, JANGAN dianggap lolos.
--
-- DAMPAK PRODUKSI: NOL untuk saat ini.
--   Tidak ada halaman yang memanggil kedua RPC ini -- useHpp dan useHppByChannel
--   membaca menu_items.hpp_override / channel_hpp langsung. Perbaikan ini
--   menyiapkan fondasi supaya HPP dinamis bisa dinyalakan, bukan menyalakannya.
--
-- TIDAK DIUBAH (disengaja):
--   LEFT JOIN + COALESCE(bh.harga_beli, 0) tetap membuat bahan resep yang belum
--   punya harga dihitung Rp0 tanpa peringatan. Saat ini semua bahan resep sudah
--   berharga sehingga tidak menggigit, tapi bahan baru yang masuk resep tanpa
--   harga akan mengecilkan HPP diam-diam. Mengubah perilaku itu (menolak atau
--   menandai) adalah keputusan tersendiri, di luar lingkup normalisasi harga.

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
