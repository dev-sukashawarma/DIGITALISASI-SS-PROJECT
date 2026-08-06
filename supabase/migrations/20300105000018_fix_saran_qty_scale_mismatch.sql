-- Migration: 20300105000018_fix_saran_qty_scale_mismatch.sql
--
-- Ditemukan saat mengecek "satuan permintaan oleh crew outlet" (audit
-- lanjutan §4): calculate_bahan_baku_request() -- RPC di balik form
-- Permintaan Bahan (Target Menu) -- menghitung saran_qty dengan
-- mengurangkan sb.saldo MENTAH (bisa gram-scale) langsung dari
-- kebutuhan (SELALU besar-scale, hasil bagi faktor_tampilan). Kalau
-- baris itu gram-scale, hasilnya salah besaran sebesar faktor konversi
-- -- bisa membuat saran_qty tampak 0 (dikira stok cukup) padahal
-- sebenarnya kurang jauh, atau sebaliknya.
--
-- Dampak nyata SAAT INI: NOL. Digrep di seluruh apps/stok, field
-- saran_qty tidak dikonsumsi di mana pun oleh frontend (PermintaanForm
-- pakai `kebutuhan` untuk qty yang diminta, bukan saran_qty). Diperbaiki
-- untuk konsistensi & mencegah bug tersembunyi kalau field ini dipakai
-- di masa depan tanpa ada yang sadar sudah salah dari awal.
--
-- `kebutuhan` dan `sisa_stok` (raw, ditampilkan via
-- formatTriUnitSaldoAdaptive di client) TIDAK diubah -- sudah benar
-- masing-masing sebagai angka besar-scale murni dan saldo mentah apa
-- adanya.

CREATE OR REPLACE FUNCTION public.calculate_bahan_baku_request(p_outlet_id uuid, p_targets jsonb)
 RETURNS TABLE(bahan_baku_id uuid, nama_bahan text, satuan text, kebutuhan numeric, sisa_stok numeric, saran_qty numeric, saldo_is_gram boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
    ROUND(k.total_kebutuhan_kecil / COALESCE(b.faktor_tampilan, b.faktor_konversi, 1), 2) AS kebutuhan,
    COALESCE(sb.saldo, 0) AS sisa_stok,
    CEIL(GREATEST(0,
      (k.total_kebutuhan_kecil / COALESCE(b.faktor_tampilan, b.faktor_konversi, 1))
      - (CASE
           WHEN COALESCE(sb.saldo_is_gram, false) AND b.faktor_tampilan IS NOT NULL
           THEN COALESCE(sb.saldo, 0) / b.faktor_tampilan
           ELSE COALESCE(sb.saldo, 0)
         END)
    )) AS saran_qty,
    COALESCE(sb.saldo_is_gram, false) AS saldo_is_gram
  FROM kebutuhan_bahan k
  JOIN bahan_baku b ON b.id = k.bahan_baku_id
  LEFT JOIN stok_balance sb ON sb.bahan_baku_id = k.bahan_baku_id AND sb.outlet_id = p_outlet_id;
END;
$function$;
