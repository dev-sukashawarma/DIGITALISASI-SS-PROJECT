-- 20300105000005_saldo_is_gram_ever_not_latest.sql
--
-- Ditemukan saat smoke test 2026-08-03: saldo_is_gram (20300105000003)
-- mendefinisikan "gram" sebagai "tulisan TERAKHIR adalah opname_selisih".
-- Kasus nyata MITRA PALEDANG / KENTANG membuktikan aturan itu terlalu rapuh:
--
--   21:48 WIB  opname_selisih   sebelum=6391.724  sesudah=3410      (baseline gram BENAR)
--   21:59 WIB  pemakaian (BOM)  sebelum=3410       sesudah=3409.7    (delta kecil gaya lama)
--   22:35 WIB  pemakaian (BOM)  sebelum=3409.7     sesudah=3409.56
--   22:45 WIB  adjustment       sebelum=3409.56    sesudah=3409.7    (tulisan TERAKHIR)
--
-- Karena tulisan terakhir bukan opname_selisih, saldo_is_gram jatuh ke FALSE
-- -> 3409,7 (yang sebenarnya ~3,41 kg, wajar) ditampilkan sebagai "3409 Dus"
-- (34 ton, mustahil) -- justru LEBIH salah daripada sebelum diperbaiki.
--
-- Baseline gram dari opname tidak hilang hanya karena disentuh transaksi kecil
-- sesudahnya (BOM/adjustment yang deltanya jauh lebih kecil dari baseline).
-- Fix: ganti "tulisan TERAKHIR adalah opname" -> "PERNAH diopname sejak batas
-- waktu" (EXISTS, bukan hanya baris ter-akhir). Begitu baseline gram
-- ditetapkan, tetap dipercaya gram -- jauh lebih aman daripada meloncat balik
-- ke tafsiran besar (yang salah 10.000x lipat) hanya karena satu transaksi
-- kecil menyusul. Akar sebenarnya (BOM/manual/distribusi belum menulis gram)
-- tetap terbuka -- lihat docs/superpowers/specs/2026-08-01-satuan-kanonik-stok-design.md.

CREATE OR REPLACE FUNCTION public.saldo_is_gram(sb public.stok_balance)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ledger_stok l
    WHERE l.outlet_id = sb.outlet_id AND l.bahan_baku_id = sb.bahan_baku_id
      AND l.tipe = 'opname_selisih'
      AND l.created_at >= '2026-08-01 20:32:00+07'::timestamptz
  );
$$;
