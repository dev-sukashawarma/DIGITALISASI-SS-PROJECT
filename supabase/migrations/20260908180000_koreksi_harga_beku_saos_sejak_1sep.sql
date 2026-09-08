-- 20260908180000_koreksi_harga_beku_saos_sejak_1sep.sql
--
-- Melengkapi 20260908170000. Membetulkan 9 baris harga beku surat jalan
-- terakhir di jendela 1 September untuk SAOS CABE dan SAOS SAMYANG.
--
-- ============================================================================
-- DASAR ANGKANYA: keterangan owner, 8 September 2026
-- ============================================================================
--   "saos cabe per dus = 244000, saos samyang per dus = 280000"
--
-- Ini fakta dari lapangan, BUKAN turunan rasio. Penting, karena SAOS SAMYANG
-- tidak bisa diselesaikan dari data: rasio harga bekunya terhadap master
-- adalah 18,95 sementara 1 Dus = 5 Kg, jadi harga per kg semestinya 56.000
-- bukan 14.774. Tak satu pun faktor terdaftar menjelaskan 18,95. Dugaan
-- terbaik: 14.774 harga produk lama dengan kemasan berbeda.
--
-- SAOS CABE sebenarnya bisa diturunkan (1 Dus = 16.500 g = 16,5 kg, dan
-- 244.002 / 16,5 = 14.788 -- dekat dengan harga beku 14.179), tetapi angka
-- owner dipakai untuk keduanya supaya seragam.
--
-- Dipakai 244.002, bukan 244.000: itu nilai yang sudah dipegang 14 baris
-- September lainnya. Menulis 244.000 akan membuat laporan bulan yang sama
-- menampilkan dua harga. Selisih Rp2 x 7 baris = Rp14.
--
-- ============================================================================
-- UJI SISI-QTY SUDAH DIJALANKAN (pelajaran dari nyaris-salah FOIL)
-- ============================================================================
-- Membandingkan harga terhadap master TIDAK CUKUP: kalau satuan bahan pernah
-- berubah, qty ikut berpindah basis sehingga pasangan (qty, harga) bisa tetap
-- benar meski harganya tampak salah. Itu yang terjadi pada FOIL.
--
-- Untuk kedua saos ini, bentuk angka qty SAMA di kedua sisi perubahan harga:
--   SAOS CABE     1-2 Sep: 0,67 1,00 2,00   |  4-8 Sep: 0,67 1,00 1,33 2,00 2,67
--   SAOS SAMYANG  1 Sep:   0,10 0,20        |  5-7 Sep: 0,20 0,40
-- Basis qty tidak berubah -- hanya sisi harga yang tertinggal. Aman.

UPDATE public.surat_jalan_item sji
SET harga_snapshot = 244002
FROM public.surat_jalan sj, public.bahan_baku b
WHERE sj.id = sji.surat_jalan_id AND b.id = sji.bahan_baku_id
  AND b.nama = 'SAOS CABE'
  AND sji.harga_snapshot < 100000
  AND (sj.created_at AT TIME ZONE 'Asia/Jakarta')::date >= '2026-09-01';

UPDATE public.surat_jalan_item sji
SET harga_snapshot = 280000
FROM public.surat_jalan sj, public.bahan_baku b
WHERE sj.id = sji.surat_jalan_id AND b.id = sji.bahan_baku_id
  AND b.nama = 'SAOS SAMYANG'
  AND sji.harga_snapshot < 100000
  AND (sj.created_at AT TIME ZONE 'Asia/Jakarta')::date >= '2026-09-01';

-- IDEMPOTEN: syarat harga_snapshot < 100000 menjadi salah setelah dijalankan.
--
-- CATATAN: baris SAOS CABE 15.000 (18 Jul - 18 Agu) dan SAOS SAMYANG 14.500
-- (22 Jul - 17 Agu) SENGAJA di luar jangkauan -- di luar jendela 1 September,
-- dan tingkat harga saat itu belum tentu sama.
