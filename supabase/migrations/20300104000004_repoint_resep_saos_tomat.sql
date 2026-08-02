-- 20300104000004_repoint_resep_saos_tomat.sql
-- SAOS TOMAT sudah is_active=false, tapi 19 resep aktif masih menunjuk ke sana.
-- trg_process_bom_stok TIDAK memfilter is_active, jadi potongan tetap jalan dari
-- baris usang dengan faktor_konversi 16500, padahal kemasan nyatanya kompan 5500
-- -> stok tomat terpotong 3x lebih sedikit dari seharusnya.
--
-- Acuan owner 2026-08-01: tomat hanya ada versi POUCH dan KOMPAN.
-- Target POUCH (keputusan owner 2026-08-02), didukung sebaran stok: POUCH ada di
-- 8 outlet, KOMPAN hanya 2.
--
-- DAMPAK: pembagi 16.500 -> 1.000, jadi potongan tomat 16,5x lebih besar.
-- Saldo bisa minus; tidak menggagalkan penjualan ('pemakaian' dikecualikan dari
-- guard no-negative) dan ditetapkan ulang oleh opname berikutnya.
--
-- Trigger sengaja TIDAK diubah: menambah filter is_active akan membuat potongan
-- dilewati secara senyap, lebih buruk daripada salah besaran.

DO $$
DECLARE
  v_lama UUID;
  v_baru UUID;
  v_n INT;
BEGIN
  SELECT id INTO v_lama FROM public.bahan_baku WHERE nama = 'SAOS TOMAT' LIMIT 1;
  SELECT id INTO v_baru FROM public.bahan_baku WHERE nama = 'SAOS TOMAT POUCH' AND is_active LIMIT 1;

  IF v_lama IS NULL THEN
    RAISE NOTICE 'SAOS TOMAT tidak ditemukan, tidak ada yang dipindah';
    RETURN;
  END IF;

  IF v_baru IS NULL THEN
    RAISE EXCEPTION 'SAOS TOMAT POUCH tidak ditemukan atau tidak aktif -- batalkan';
  END IF;

  UPDATE public.resep_item SET bahan_baku_id = v_baru WHERE bahan_baku_id = v_lama;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'resep_item dipindah: % baris', v_n;
END;
$$;
