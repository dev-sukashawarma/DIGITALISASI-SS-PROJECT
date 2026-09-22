-- calc_porsi_qty: buang STRICT supaya planner bisa meng-inline fungsinya.
--
-- Masalah: fungsi ini dipanggil per (baris stok_balance x resep_item) di
-- kolom `status` & `projection_text` pada monitoring_view_spv dan
-- monitoring_view_crew (satu-satunya pemakai). Karena dideklarasikan STRICT
-- sementara badannya memakai COALESCE, Postgres tak bisa membuktikan badannya
-- strict -> fungsi TIDAK di-inline dan dieksekusi sebagai pemanggilan SQL
-- function terpisah. Terukur 2026-09-22: 12.500 panggilan = 432 ms, versi
-- inline = ~5 ms. monitoring_view_spv memakan ~35% total waktu DB
-- (pg_stat_statements 17-22 Sep, 838 ms rata-rata, 23.543 panggilan).
--
-- Semantik DIPERTAHANKAN: STRICT berarti "argumen apa pun NULL -> NULL".
-- Itu kini ditulis eksplisit sebagai cabang CASE pertama. Diverifikasi
-- sebelum apply: 0 beda dari 39.334 pasangan resep_item x bahan_baku,
-- termasuk 3.878 pasangan ber-argumen NULL.
--
-- CREATE OR REPLACE mempertahankan owner & GRANT yang ada. PARALLEL SAFE
-- ditambahkan (fungsi murni, tanpa akses tabel).

CREATE OR REPLACE FUNCTION public.calc_porsi_qty(
  p_qty_per_porsi numeric,
  p_ri_satuan text,
  p_b_satuan text,
  p_b_satuan_kecil text,
  p_b_faktor_tampilan numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $function$
  SELECT CASE
    -- Pengganti STRICT: argumen apa pun NULL -> NULL.
    WHEN p_qty_per_porsi IS NULL OR p_ri_satuan IS NULL OR p_b_satuan IS NULL
      OR p_b_satuan_kecil IS NULL OR p_b_faktor_tampilan IS NULL
      THEN NULL
    WHEN lower(p_ri_satuan) = lower(p_b_satuan_kecil) AND COALESCE(p_b_faktor_tampilan, 1) > 0
      THEN p_qty_per_porsi / p_b_faktor_tampilan
    WHEN lower(p_ri_satuan) IN ('gram', 'gr', 'g') AND lower(p_b_satuan_kecil) IN ('ml', 'mili') AND COALESCE(p_b_faktor_tampilan, 1) > 0
      THEN p_qty_per_porsi / p_b_faktor_tampilan
    WHEN lower(p_ri_satuan) IN ('ml', 'mili') AND lower(p_b_satuan_kecil) IN ('gram', 'gr', 'g') AND COALESCE(p_b_faktor_tampilan, 1) > 0
      THEN p_qty_per_porsi / p_b_faktor_tampilan
    WHEN lower(p_ri_satuan) = 'liter' AND lower(p_b_satuan_kecil) IN ('ml', 'mili') AND COALESCE(p_b_faktor_tampilan, 1) > 0
      THEN (p_qty_per_porsi * 1000.0) / p_b_faktor_tampilan
    WHEN lower(p_ri_satuan) = 'kg' AND lower(p_b_satuan_kecil) IN ('gram', 'gr', 'g') AND COALESCE(p_b_faktor_tampilan, 1) > 0
      THEN (p_qty_per_porsi * 1000.0) / p_b_faktor_tampilan
    WHEN lower(p_ri_satuan) IN ('gram', 'gr', 'g') AND lower(p_b_satuan) = 'kg'
      THEN p_qty_per_porsi / 1000.0
    WHEN lower(p_ri_satuan) IN ('ml', 'mili') AND lower(p_b_satuan) = 'liter'
      THEN p_qty_per_porsi / 1000.0
    WHEN lower(p_ri_satuan) = 'kg' AND lower(p_b_satuan) IN ('gram', 'gr', 'g')
      THEN p_qty_per_porsi * 1000.0
    WHEN lower(p_ri_satuan) = 'liter' AND lower(p_b_satuan) IN ('ml', 'mili')
      THEN p_qty_per_porsi * 1000.0
    WHEN lower(p_ri_satuan) = lower(p_b_satuan)
      THEN p_qty_per_porsi
    ELSE p_qty_per_porsi
  END;
$function$;
