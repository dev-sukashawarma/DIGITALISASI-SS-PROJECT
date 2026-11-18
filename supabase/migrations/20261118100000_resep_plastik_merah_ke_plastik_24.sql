-- Resep: PLASTIK MERAH diganti PLASTIK 24 (keputusan owner 2026-11-18)
--
-- Lapangan sudah memakai Plastik 24 (111 SJ dalam 30 hari vs 24 SJ Plastik
-- Merah), tetapi resep masih memotong Plastik Merah. Semua 37 resep aktif yang
-- memuat Plastik Merah (25 global + 12 "Voucher Pamulang 10%"), termasuk
-- Ice Tea & Orange Jus, kini memotong 1 lembar Plastik 24 per porsi.
--
-- Kedua bahan bersatuan kecil Lembar, jadi qty_per_porsi tetap 1.
-- Berlaku ke depan saja; ledger historis tidak disentuh.
-- hpp_override tidak disentuh (laporan laba tidak bergeser).

DO $$
DECLARE
  c_merah CONSTANT uuid := 'bfb13b95-08bb-40bd-bbbc-29b4a023684f';
  c_p24   CONSTANT uuid := '8dba860c-afd7-4d2c-8ee5-a063aca1dee1';
  v_n int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM resep_item a JOIN resep_item b ON a.resep_id = b.resep_id
    WHERE a.bahan_baku_id = c_merah AND b.bahan_baku_id = c_p24
  ) THEN
    RAISE EXCEPTION 'Ada resep yang sudah memuat Plastik Merah DAN Plastik 24';
  END IF;

  UPDATE resep_item
     SET bahan_baku_id = c_p24,
         satuan = 'Lembar'
   WHERE bahan_baku_id = c_merah;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_n <> 37 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: diharapkan 37 baris, terubah %', v_n;
  END IF;

  IF EXISTS (SELECT 1 FROM resep_item WHERE bahan_baku_id = c_merah) THEN
    RAISE EXCEPTION 'ASERSI GAGAL: masih ada resep memuat Plastik Merah';
  END IF;
END $$;
