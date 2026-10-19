-- =============================================================================
-- 20261019100000_extra_keju_2_lembar.sql
-- =============================================================================
-- Konfirmasi owner 2026-10-19: satu porsi "Extra Keju" = 2 lembar keju.
--
-- Resepnya tercatat 1 lembar, jadi setiap Extra Keju yang terjual hanya
-- memotong 1 lembar KEJU dan opname outlet selalu minus. Diperiksa ke DB live
-- sebelum migration ini ditulis (1–18 Okt 2026):
--   * Suka Beef & Suka Chicken (dan paket berisi keduanya) SUDAH benar 2 lembar
--     — ledger `pemakaian` KEJU per order -2 / -4, tidak diubah.
--   * Extra Keju memotong -1 per porsi; ±1.100 porsi terjual di Oktober.
--   * Minus opname KEJU per outlet sebanding dengan jumlah Extra Keju terjual
--     (mis. Depok Sukmajaya 113 porsi vs -102 lembar, Jagakarsa 95 vs -105,
--     Dramaga 67 vs -74) — cocok dengan kekurangan 1 lembar per porsi.
--
-- KEJU: Dus = 24 Pack × 10 Lembar = 240 lembar @ Rp 289.047 -> Rp 1.204/lembar.
--   sebelum: 1 lembar = Rp 1.204/porsi
--   sesudah: 2 lembar = Rp 2.409/porsi (hpp_override Rp 3.850 tidak disentuh)
--
-- Hanya SATU baris resep untuk menu ini (global, aktif, tanpa salinan outlet).
--
-- Berlaku ke depan saja (keputusan owner). Baris ledger historis TIDAK disentuh
-- — jejak audit, dan opname rutin outlet sudah menyerap selisih lama (pola sama
-- dengan 20260916120000 Extra Kentang dan keputusan 2026-09-09 K1).
-- =============================================================================
BEGIN;

UPDATE public.resep_item ri
   SET qty_per_porsi = 2
  FROM public.resep r
  JOIN public.menu_items m ON m.id::text = r.menu_item_ref
 WHERE ri.resep_id = r.id
   AND m.name = 'Extra Keju'
   AND ri.bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama = 'KEJU')
   AND ri.qty_per_porsi = 1;

DO $$
DECLARE v_n int; v_qty numeric;
BEGIN
  SELECT count(*), min(ri.qty_per_porsi) INTO v_n, v_qty
    FROM public.resep_item ri
    JOIN public.resep r ON r.id = ri.resep_id
    JOIN public.menu_items m ON m.id::text = r.menu_item_ref
   WHERE m.name = 'Extra Keju';

  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: baris resep Extra Keju = % (harap 1)', v_n;
  END IF;
  IF v_qty <> 2 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: qty_per_porsi = % (harap 2)', v_qty;
  END IF;
END $$;

COMMIT;
