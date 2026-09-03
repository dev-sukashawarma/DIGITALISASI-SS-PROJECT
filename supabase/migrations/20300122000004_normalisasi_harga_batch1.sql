-- 20300122000004_normalisasi_harga_batch1.sql
--
-- Batch pertama normalisasi basis harga bahan baku (6 bahan), hasil konfirmasi
-- owner 2 September 2026 lewat lembar "Konfirmasi Basis Harga".
--
-- BASIS KANONIK yang ditetapkan:
--   harga_beli  = harga per SATUAN BESAR (satu-satunya tafsiran, tidak lagi campur)
--   kemasan_qty = faktor PENUH (jumlah satuan kecil dalam 1 satuan besar)
--   -> harga per satuan kecil selalu = harga_beli / kemasan_qty
--
-- ============================================================
-- BAGIAN 1 -- WAJIB DULUAN. sync_harga_beli_display()
-- ============================================================
-- Trigger ini menulis ulang harga_beli_display SETIAP KALI harga_beli berubah,
-- memakai faktor_konversi sebagai pembagi:
--     display = (harga_beli / faktor_konversi) * kemasan_qty
-- Rumus itu hanya benar untuk bahan 2 tingkat (faktor_konversi = faktor penuh).
-- Untuk bahan 3 tingkat ia meledak. Diverifikasi terhadap harga batch ini:
--     KEJU     (289.056 / 10)   * 240    = Rp6.937.344   (seharusnya Rp289.056)
--     KUNYIT   (394.992 / 24)   * 432    = Rp7.109.856   (seharusnya Rp394.992)
--     KETUMBAR (812.500 / 1000) * 25.000 = Rp20.312.500  (seharusnya Rp812.500)
-- Jadi memperbarui harga TANPA memperbaiki trigger ini lebih dulu akan merusak
-- 3 dari 6 baris di batch ini. Urutan di file ini mengikat -- jangan dibalik.
--
-- Pembagi diganti ke faktor PENUH, memakai ekspresi kanonik yang sama dengan
-- trg_process_bom_stok (20300108000005), to_ledger_scale(), dan
-- get_waste_breakdown (20300120000001) -- satu aturan faktor untuk seluruh sistem.

CREATE OR REPLACE FUNCTION public.sync_harga_beli_display()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_penuh NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.harga_beli IS DISTINCT FROM OLD.harga_beli THEN
    SELECT GREATEST(
             COALESCE(
               CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
                    THEN b.faktor_tampilan
                    ELSE b.faktor_konversi
               END, 1),
             1)
      INTO v_penuh
    FROM public.bahan_baku b
    WHERE b.id = NEW.bahan_baku_id;

    v_penuh := COALESCE(v_penuh, 1);

    IF NEW.kemasan_qty IS NOT NULL AND NEW.kemasan_qty > 0 THEN
      -- Kali dulu, bagi belakangan. Versi pertama membagi lebih dulu dan KUNYIT
      -- meleset 1,4e-14 rupiah: 394.992/432 = 914,3333... (desimal tak berujung),
      -- dikali 432 lagi tidak kembali persis. Nilainya tak berarti, tapi merusak
      -- pemeriksaan `harga_beli = harga_beli_display` yang dipakai memverifikasi
      -- tiap batch normalisasi -- jadi lebih baik eksak.
      NEW.harga_beli_display := (NEW.harga_beli * NEW.kemasan_qty) / v_penuh;
    ELSE
      NEW.harga_beli_display := NEW.harga_beli;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- BAGIAN 2 -- 6 bahan batch pertama
-- ============================================================
-- Tiap UPDATE dikunci ke nilai lama yang diverifikasi ke DB live 2 Sep 2026.
-- Kalau nilainya sudah berubah (dev lain, penerimaan PO), baris itu di-SKIP
-- dan tidak tertimpa diam-diam -- aman diulang.
--
-- bahan          basis dikonfirmasi        harga lama -> baru        kemasan lama -> baru
-- KEJU           Rp12.044 per Pack         10.850     -> 289.056     10    -> 240
-- KERTAS STRUK   Rp1.600  per Roll          1.600     -> 16.000       1    -> 10
-- KETUMBAR       Rp32.500 per Kg           32.500     -> 812.500  1.000    -> 25.000
-- KUNYIT         Rp21.944 per Pack         10.972     -> 394.992  1.000    -> 432
-- MIE            Rp3.000  per Bungkus       3.000     -> 120.000      1    -> 40
-- Cling Wrap     Rp10.135 per Roll         10.135     -> 243.240      1    -> 24

UPDATE public.bahan_baku_harga h SET harga_beli = 289056, kemasan_qty = 240,   kemasan_satuan = 'Lembar'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'KEJU'         AND h.harga_beli = 10850;

UPDATE public.bahan_baku_harga h SET harga_beli = 16000,  kemasan_qty = 10,    kemasan_satuan = 'Roll'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'KERTAS STRUK' AND h.harga_beli = 1600;

UPDATE public.bahan_baku_harga h SET harga_beli = 812500, kemasan_qty = 25000, kemasan_satuan = 'gram'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'KETUMBAR'     AND h.harga_beli = 32500;

UPDATE public.bahan_baku_harga h SET harga_beli = 394992, kemasan_qty = 432,   kemasan_satuan = 'Sachet'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'KUNYIT'       AND h.harga_beli = 10972;

UPDATE public.bahan_baku_harga h SET harga_beli = 120000, kemasan_qty = 40,    kemasan_satuan = 'Bungkus'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'MIE'          AND h.harga_beli = 3000;

UPDATE public.bahan_baku_harga h SET harga_beli = 243240, kemasan_qty = 24,    kemasan_satuan = 'Roll'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'Cling Wrap'   AND h.harga_beli = 10135;

-- ============================================================
-- CATATAN
-- ============================================================
-- 1. harga_beli_display untuk bahan LAIN yang tidak disentuh batch ini tetap
--    memakai angka lama sampai harganya diperbarui -- trigger baru hanya jalan
--    saat ada perubahan harga. Itu disengaja: tidak menyentuh yang belum
--    dikonfirmasi.
-- 2. get_hpp_periode dan get_hpp_periode_by_channel MASIH memakai
--    faktor_konversi sebagai pembagi, jadi untuk 3 bahan 3-tingkat di batch ini
--    HPP-nya akan salah sampai kedua fungsi itu ikut diperbaiki. Tidak ada
--    dampak produksi hari ini karena tidak ada halaman yang memanggilnya
--    (semua laporan memakai hpp_override), tapi jangan menyalakan HPP dinamis
--    sebelum itu beres.
-- 3. Jalur penerimaan PO (po_triggers, merge_fifo_po) menulis ulang harga_beli.
--    Belum diaudit. Kalau satuan input PO tidak diseragamkan, normalisasi ini
--    bisa luntur pada penerimaan barang berikutnya.
