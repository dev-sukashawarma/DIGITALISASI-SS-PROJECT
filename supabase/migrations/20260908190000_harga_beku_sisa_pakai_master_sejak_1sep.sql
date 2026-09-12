-- 20260908190000_harga_beku_sisa_pakai_master_sejak_1sep.sql
--
-- Menutup 35 baris terakhir harga beku surat jalan di jendela 1 September,
-- dengan menyamakannya ke harga master yang berlaku sekarang.
--
-- ============================================================================
-- KEPUTUSAN OWNER, 8 September 2026
-- ============================================================================
--   "pakai B, nanti kalau setelah audit ada perubahan harga nanti inject saja
--    perubahan harganya"
--
-- Artinya: harga yang dikonfirmasi hari ini dipakai sebagai dasar; kalau audit
-- menemukan harga awal September ternyata berbeda, selisihnya disuntikkan
-- belakangan. Pendekatan yang sama sudah dipakai untuk SAOS CABE dan
-- SAOS SAMYANG di 20260908180000 -- angka yang owner sebutkan di sana memang
-- sama dengan masternya.
--
-- ============================================================================
-- KENAPA TIDAK BISA DIHITUNG SAJA DARI HARGA BEKUNYA
-- ============================================================================
-- Karena normalisasi 3 September (20300122000001 & ...004) TIDAK mengalikan
-- harga lama -- ia MENGGANTINYA. Nilai lama hanya dipakai sebagai kunci
-- pengaman di klausa WHERE:
--
--   UPDATE bahan_baku_harga SET harga_beli = 248004, kemasan_qty = 12000
--     WHERE nama = 'MAYONAISE' AND harga_beli = 23706;
--
-- 248.004 tidak dihitung dari 23.706; itu harga yang dikonfirmasi terpisah.
-- Batch pertama menyatakannya terang-terangan:
--   "KEJU  Rp12.044 per Pack   10.850 -> 289.056   10 -> 240"
-- Basis keju yang benar Rp12.044/Pack (x24 = 289.056), sementara yang beku
-- 10.850 -- bukan soal satuan, memang harga yang lebih lama.
--
-- Jadi rasio harga-beku terhadap master mencampur perubahan SATUAN dan
-- perubahan HARGA sekaligus, dan basis harga lamanya tidak tercatat di mana
-- pun. Tidak ada perkalian yang bisa memulihkannya.
--
-- ============================================================================
-- UJI SISI-QTY SUDAH DIJALANKAN untuk kelima bahan
-- ============================================================================
-- Bentuk angka qty_dikirim SAMA di kedua sisi perubahan harga, jadi basis qty
-- tidak ikut berpindah (beda dengan FOIL):
--   MAYONAISE         1 2 3           vs  1 2 3 4 5
--   SAOS TOMAT POUCH  0,5 1           vs  1
--   PAPER WRAP        0,2 0,3 0,4 0,5 vs  0,2 0,3
--   KEJU              0,5 1           vs  0,5 0,67 1 2
--   PLASTIK MERAH     0,2 0,4         vs  0,2 0,4

UPDATE public.surat_jalan_item sji
SET harga_snapshot = h.harga_beli
FROM public.surat_jalan sj, public.bahan_baku b, public.bahan_baku_harga h
WHERE sj.id = sji.surat_jalan_id
  AND b.id  = sji.bahan_baku_id
  AND h.bahan_baku_id = b.id
  AND b.nama IN ('MAYONAISE','SAOS TOMAT POUCH','PAPER WRAP','KEJU','PLASTIK MERAH')
  AND sji.harga_snapshot < h.harga_beli / 2
  AND (sj.created_at AT TIME ZONE 'Asia/Jakarta')::date >= '2026-09-01';

-- IDEMPOTEN: setelah dijalankan harga_snapshot = harga_beli, sehingga syarat
-- "< harga_beli / 2" menjadi salah. Aman diulang.
--
-- SENGAJA DI LUAR JANGKAUAN:
--   FOIL (10 baris)    -- sudah benar; qty-nya dalam Roll, harga per Roll.
--                         Lihat 20260908170000 untuk bukti lengkapnya.
--   POLYBAG (2 baris)  -- master datanya ditahan ("1 bal = 25 pak" bertentangan
--                         dengan faktor_tengah = 5).
--   35 baris ber-harga-beda-tapi-satuan-benar (SAPI 100.000, FOIL lama 11.554)
--                      -- itu pembekuan yang bekerja sebagaimana mestinya.
