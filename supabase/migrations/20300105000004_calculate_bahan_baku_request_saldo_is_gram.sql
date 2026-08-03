-- 20300105000004_calculate_bahan_baku_request_saldo_is_gram.sql
--
-- Tambah kolom saldo_is_gram ke keluaran calculate_bahan_baku_request supaya
-- frontend (PermintaanForm.tsx "Sisa" preview) bisa menampilkan sisa_stok
-- dengan benar lewat formatTriUnitSaldoAdaptive, konsisten dengan
-- monitoring_view_spv/_crew (migration 20300105000003).
--
-- TEMUAN SAMPINGAN (belum diperbaiki, di luar cakupan fix tampilan ini):
-- saran_qty = CEIL(kebutuhan - sb.saldo), di mana `kebutuhan` dihitung dalam
-- SATUAN BESAR (total_kebutuhan_kecil / faktor_tampilan) tapi `sb.saldo` bisa
-- jadi SATUAN KECIL (gram) untuk baris yang sudah "meloncat" lewat opname.
-- Untuk baris begitu, saran_qty BUKAN cuma salah tampil -- jumlah yang
-- disarankan untuk diminta ke gudang ikut salah. Perlu migration terpisah
-- yang mengonversi salah satu sisi sebelum pengurangan, berdasar saldo_is_gram.

-- Menambah kolom OUT (saldo_is_gram) mengubah return type -- CREATE OR REPLACE
-- ditolak Postgres untuk kasus ini, wajib DROP dulu.
DROP FUNCTION IF EXISTS public.calculate_bahan_baku_request(uuid, jsonb);

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
    CEIL(GREATEST(0, (k.total_kebutuhan_kecil / COALESCE(b.faktor_tampilan, b.faktor_konversi, 1)) - COALESCE(sb.saldo, 0))) AS saran_qty,
    COALESCE(sb.saldo_is_gram, false) AS saldo_is_gram
  FROM kebutuhan_bahan k
  JOIN bahan_baku b ON b.id = k.bahan_baku_id
  LEFT JOIN stok_balance sb ON sb.bahan_baku_id = k.bahan_baku_id AND sb.outlet_id = p_outlet_id;
END;
$function$;
