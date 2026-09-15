-- supabase/migrations/20260915200000_nyalakan_bom_tiga_outlet.sql
-- Spec: docs/superpowers/specs/2026-09-15-hpp-dinamis-harga-kiriman-design.md §5.1
-- Tiga outlet mitra dibuat 17-31 Jul 2026 dengan is_bom_enabled=false (semua
-- outlet lain true, termasuk Pamulang 8 Sep). 3.676 order September mereka
-- tidak pernah memotong stok; satu-satunya pergerakan keluar = opname_selisih.
-- Tidak ada koreksi mundur (aturan owner: Agustus dilewati; saldo hari ini
-- dijaga opname harian). Mulai apply, order completed memotong stok.
BEGIN;

DO $$
DECLARE v_n int;
BEGIN
  -- Pra-cek: tiap outlet punya stok_balance untuk bahan resep
  -- 27 bahan resep aktif; SAUS CABE & AQUA tak punya stok_balance di 3 outlet (SAUS CABE juga minus di 10 outlet lain — masalah master data resep, bukan pemblokir).
  SELECT count(*) INTO v_n FROM outlets o
  WHERE o.name IN ('MITRA CICURUG','MITRA SENTUL','MITRA CILEUNGSI')
    AND (SELECT count(*) FROM stok_balance sb WHERE sb.outlet_id=o.id
           AND sb.bahan_baku_id IN (SELECT bahan_baku_id FROM resep_item)) < 25;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'PRA-CEK GAGAL: % outlet punya <25 baris stok_balance bahan resep', v_n;
  END IF;
END $$;

UPDATE public.outlets
   SET is_bom_enabled = true
 WHERE name IN ('MITRA CICURUG','MITRA SENTUL','MITRA CILEUNGSI')
   AND is_bom_enabled = false;

DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM outlets
  WHERE type IN ('outlet','mitra') AND is_active AND COALESCE(is_bom_enabled,false) = false;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: masih % outlet aktif dengan BOM mati', v_n;
  END IF;
END $$;

COMMIT;
