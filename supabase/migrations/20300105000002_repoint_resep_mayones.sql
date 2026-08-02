-- 20300105000002_repoint_resep_mayones.sql
--
-- Kelas bug identik dengan 20300104000004 (SAOS TOMAT), ditemukan oleh query
-- verifikasi "resep menunjuk bahan non-aktif" setelah migration itu diterapkan:
--
--   MAYONES    is_active=false  faktor_konversi=12000  <- 12 resep AKTIF menunjuk ke sini
--   MAYONAISE  is_active=true   faktor_konversi=1000   <- 0 resep
--
-- trg_process_bom_stok TIDAK memfilter is_active, jadi potongan tetap jalan dari
-- baris usang dengan pembagi 12.000 -> mayones terpotong 12x LEBIH SEDIKIT dari
-- seharusnya di 12 resep.
--
-- MAYONES juga mengidap penyakit tingkat-tengah yang sama seperti SAOS TOMAT:
-- faktor_tampilan 144.000 (= 12 x 12.000) berarti 1 "Kg" dianggap 12.000 gram.
-- MAYONAISE sudah benar: Dus -> Kg x12 -> Gram x12.000, fk 1.000, sesuai acuan
-- owner 2026-08-01 (1 dus = 12 kg = 12.000 gram).
--
-- DAMPAK: pembagi 12.000 -> 1.000, potongan mayones menjadi 12x lebih besar.
-- Potongan berpindah ke baris MAYONAISE yang punya saldo di 26 outlet (total
-- 347.656) sehingga tidak langsung minus. Sisa 70,9 di MAYONES menjadi yatim
-- (tak ada lagi yang memotongnya) dan dibereskan lewat opname, BUKAN lewat
-- UPDATE stok_balance langsung.
--
-- Trigger sengaja TIDAK diubah: menambah filter is_active akan membuat potongan
-- dilewati secara senyap, lebih buruk daripada salah besaran.

DO $$
DECLARE
  v_lama UUID;
  v_baru UUID;
  v_n INT;
BEGIN
  SELECT id INTO v_lama FROM public.bahan_baku WHERE nama = 'MAYONES' LIMIT 1;
  SELECT id INTO v_baru FROM public.bahan_baku WHERE nama = 'MAYONAISE' AND is_active LIMIT 1;

  IF v_lama IS NULL THEN
    RAISE NOTICE 'MAYONES tidak ditemukan, tidak ada yang dipindah';
    RETURN;
  END IF;

  IF v_baru IS NULL THEN
    RAISE EXCEPTION 'MAYONAISE tidak ditemukan atau tidak aktif -- batalkan';
  END IF;

  UPDATE public.resep_item SET bahan_baku_id = v_baru WHERE bahan_baku_id = v_lama;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'resep_item dipindah: % baris', v_n;
END;
$$;
