-- =============================================================================
-- 20260915236000_plastik_besar_kemasan_qty_250.sql
-- =============================================================================
-- PLASTIK BESAR: satuan Ikat / Pack (5) / Lembar (50) → faktor_tampilan 250,
-- faktor_konversi 50, faktor_po 50 — semuanya konsisten 250 Lembar per Ikat.
-- Hanya bahan_baku_harga.kemasan_qty yang menyimpang (100), sisa dari
-- normalisasi 3 Sep yang sengaja melewatinya ("belum dijawab").
--
-- Konfirmasi owner 2026-09-15: harga_beli Rp6.000 (input manual 18 Agu, tanpa
-- PO) adalah angka uji, bukan harga nyata. Harga DIBIARKAN — PO pertama yang
-- lolos guard akan menimpanya lewat verifikasi_terima_po (master + katalog).
-- Yang diluruskan hanya kemasan_qty → 250 agar:
--   * nilai persediaan memakai pembagi yang sama dengan faktor bahan;
--   * penjaga isi-kemasan (20260915234000) tidak lagi menahan katalog vendor
--     bahan ini (kemasan_qty ≠ faktor_tampilan → INSERT katalog dilewati).
-- Dampak: 0 resep memakai bahan ini (HPP tak berubah); saldo ledger tak disentuh.
-- =============================================================================
BEGIN;

UPDATE public.bahan_baku_harga h
   SET kemasan_qty = 250
  FROM public.bahan_baku b
 WHERE h.bahan_baku_id = b.id AND b.nama = 'PLASTIK BESAR' AND h.kemasan_qty = 100;

DO $$
DECLARE v_k numeric; v_f numeric;
BEGIN
  SELECT h.kemasan_qty, b.faktor_tampilan INTO v_k, v_f
    FROM public.bahan_baku b JOIN public.bahan_baku_harga h ON h.bahan_baku_id = b.id
   WHERE b.nama = 'PLASTIK BESAR';
  IF v_k IS DISTINCT FROM v_f THEN
    RAISE EXCEPTION 'ASERSI GAGAL: PLASTIK BESAR kemasan_qty % <> faktor_tampilan %', v_k, v_f;
  END IF;
END $$;

COMMIT;
